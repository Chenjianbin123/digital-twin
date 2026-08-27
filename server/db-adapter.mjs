import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { URL } from 'node:url';
import mysql from 'mysql2/promise';
import { createDbAuth } from './db-auth.mjs';
import { createDbAuthService, DbAuthError } from './db-auth-service.mjs';
import { resolveDbAdapterHost } from './db-adapter-host.mjs';

const PORT = Number(process.env.DB_ADAPTER_PORT || 8788);
const HOST = resolveDbAdapterHost();
const DEFAULT_AREA_CODE = process.env.DB_DEFAULT_AREA_CODE || '2001';
const MASK_PATIENT_NAME = process.env.DB_MASK_PATIENT_NAME !== 'false';
const configuredAuthSecret = process.env.DB_AUTH_SECRET?.trim();
const authSecret = configuredAuthSecret || randomBytes(32).toString('hex');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '192.168.96.104',
  port: Number(process.env.DB_PORT || 23306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dnk_swp_db',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 6),
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000),
});

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  json(res, 404, { error: 'Not found' });
}

function errorJson(res, error) {
  if (error instanceof DbAuthError)
    return json(res, error.status, { error: error.message });
  console.error('[db-adapter]', error instanceof Error ? error.message : error);
  return json(res, 500, { error: '数据库服务异常，请稍后重试' });
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024)
      throw new DbAuthError(400, '请求内容过大');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  }
  catch {
    throw new DbAuthError(400, '请求格式错误');
  }
}

function requestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || '';
}

function normalizeText(value, fallback = '') {
  if (value == null)
    return fallback;
  return String(value).trim();
}

function maskName(name) {
  const text = normalizeText(name);
  if (!MASK_PATIENT_NAME || !text)
    return text;
  if (text.length <= 1)
    return '*';
  return `${text[0]}${'*'.repeat(Math.min(2, text.length - 1))}`;
}

function formatDateTime(value) {
  if (!value)
    return '';
  if (value instanceof Date)
    return value.toISOString().replace('T', ' ').slice(0, 19);
  return String(value);
}

function statusCodeFromDevice(device) {
  if (!device)
    return '';
  if (device.is_online === '0')
    return '9';
  return '';
}

function isActivePatient(patient) {
  if (!patient)
    return false;
  return !patient.sick_out_time || ['1', '2', '3', '', null, undefined].includes(patient.sick_status);
}

function mapNursingColor(level) {
  const text = normalizeText(level);
  if (text.includes('特'))
    return '#e53935';
  if (text.includes('一'))
    return '#f57c00';
  if (text.includes('二'))
    return '#1976d2';
  if (text.includes('三'))
    return '#43a047';
  return '#4dd0e1';
}

function getBedPosition(index, total) {
  const layouts = {
    1: [{ x: 0, z: -0.5 }],
    2: [{ x: -3.4, z: 0 }, { x: 3.4, z: 0 }],
    3: [{ x: -4.5, z: -0.5 }, { x: 0, z: -0.5 }, { x: 4.5, z: -0.5 }],
    4: [{ x: -4.8, z: -3 }, { x: 4.8, z: -3 }, { x: -4.8, z: 3 }, { x: 4.8, z: 3 }],
    5: [{ x: -5, z: -3.5 }, { x: 5, z: -3.5 }, { x: -5, z: 0.5 }, { x: 5, z: 0.5 }, { x: 0, z: 4 }],
    6: [{ x: -5.2, z: -4 }, { x: 5.2, z: -4 }, { x: -5.2, z: 0 }, { x: 5.2, z: 0 }, { x: -5.2, z: 4 }, { x: 5.2, z: 4 }],
  };
  const layout = layouts[Math.min(6, Math.max(1, total))] || layouts[6];
  return layout[index] || layout[layout.length - 1] || { x: 0, z: 0 };
}

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

const dbAuth = createDbAuth({
  secret: authSecret,
  pendingTtlSeconds: Number(process.env.DB_AUTH_PENDING_TTL_SECONDS || 5 * 60),
  sessionTtlSeconds: Number(process.env.DB_AUTH_TTL_SECONDS || 8 * 60 * 60),
});
const authService = createDbAuthService({ query, auth: dbAuth });

async function getArea(areaCode) {
  const rows = await query(
    `
      SELECT a.*, d.dept_name, d.dept_code
      FROM hosp_area_info a
      LEFT JOIN hosp_dept_area da ON da.area_id = a.id
      LEFT JOIN hosp_dept_info d ON d.id = da.dept_id
      WHERE (a.area_code = ? OR a.area_out_code = ? OR CAST(a.id AS CHAR) = ?)
        AND IFNULL(a.is_enable, '1') = '1'
      ORDER BY da.id
      LIMIT 1
    `,
    [areaCode, areaCode, areaCode],
  );
  if (!rows.length)
    throw new Error(`未找到病区：${areaCode}`);
  return rows[0];
}

async function listAreas() {
  return query(`
    SELECT a.id, a.area_code areaCode, a.area_name areaName,
           COUNT(DISTINCT r.id) roomCount,
           COUNT(DISTINCT b.id) bedCount,
           COUNT(DISTINCT d.id) deviceCount
    FROM hosp_area_info a
    LEFT JOIN hosp_sickroom_info r ON r.area_id = a.id AND IFNULL(r.is_enable, '1') = '1'
    LEFT JOIN hosp_bed_info b ON b.area_id = a.id AND IFNULL(b.is_enable, '1') = '1'
    LEFT JOIN swp_device_info d ON d.area_id = a.id AND IFNULL(d.is_enable, '1') = '1'
    WHERE IFNULL(a.is_enable, '1') = '1'
    GROUP BY a.id, a.area_code, a.area_name
    HAVING roomCount > 0 OR bedCount > 0 OR deviceCount > 0
    ORDER BY bedCount DESC, deviceCount DESC, a.sort, a.id
    LIMIT 100
  `);
}

async function getHospitalInfo() {
  const rows = await query(`
    SELECT hospital_name hospitalName,
           hospital_note hospitalNote,
           hospital_logo_pic hospitalLogoPic,
           hospital_address hospitalAddress,
           bed_num bedNum
    FROM hosp_hospital_info
    ORDER BY id
    LIMIT 1
  `);
  return rows[0] || null;
}

async function getTemplate(id) {
  const rows = await query(
    `
      SELECT id,
             template_name templateName,
             template_content templateContent,
             analyze_type analyzeType,
             template_type templateType,
             main_color mainColor
      FROM swp_template_info
      WHERE id = ?
      LIMIT 1
    `,
    [Number(id)],
  );
  if (!rows.length || !rows[0].templateContent)
    throw new Error(`未找到模板：${id}`);
  return rows[0];
}

async function getTwin(areaCode = DEFAULT_AREA_CODE) {
  const area = await getArea(areaCode);
  const [rooms, beds, devices, patients, vitals, risks, calls, alarms, hospitalInfo] = await Promise.all([
    query(
      `
        SELECT *
        FROM hosp_sickroom_info
        WHERE area_id = ? AND IFNULL(is_enable, '1') = '1'
        ORDER BY sort, id
      `,
      [area.id],
    ),
    query(
      `
        SELECT *
        FROM hosp_bed_info
        WHERE area_id = ? AND IFNULL(is_enable, '1') = '1'
        ORDER BY sickroom_id, sort, id
      `,
      [area.id],
    ),
    query(
      `
        SELECT d.*, t.device_type_code, t.device_type_name
        FROM swp_device_info d
        LEFT JOIN swp_device_type t ON t.id = d.device_type_id
        WHERE d.area_id = ? AND IFNULL(d.is_enable, '1') = '1'
        ORDER BY d.sickroom_id, d.bed_id, d.sort, d.id
      `,
      [area.id],
    ),
    query(
      `
        SELECT *
        FROM out_sick_info
        WHERE (area_out_code = ? OR area_out_code = ?)
          AND (sick_out_time IS NULL OR sick_status IN ('1','2','3'))
        ORDER BY sick_in_time DESC, create_time DESC, id DESC
      `,
      [area.area_out_code, area.area_code],
    ),
    query(
      `
        SELECT p.*
        FROM swp_physical_info p
        INNER JOIN (
          SELECT sick_serial_no, MAX(record_time) max_time
          FROM swp_physical_info
          WHERE sick_serial_no IS NOT NULL
          GROUP BY sick_serial_no
        ) latest
          ON latest.sick_serial_no = p.sick_serial_no
         AND latest.max_time = p.record_time
      `,
    ),
    query(
      `
        SELECT *
        FROM out_sick_high_risk
        WHERE sick_serial_no IS NOT NULL
        ORDER BY evaluation_time DESC, create_time DESC, id DESC
      `,
    ),
    query(
      `
        SELECT *
        FROM swp_call_info
        WHERE area_id = ?
        ORDER BY call_start_time DESC, id DESC
        LIMIT 30
      `,
      [area.id],
    ),
    query(
      `
        SELECT *
        FROM swp_alarm_info
        WHERE area_id = ?
        ORDER BY alarm_start_time DESC, id DESC
        LIMIT 30
      `,
      [area.id],
    ),
    getHospitalInfo(),
  ]);

  const devicesByRoom = groupBy(devices, 'sickroom_id');
  const bedDevicesByBed = groupBy(
    devices.filter(device => ['101', '102', '103'].includes(normalizeText(device.device_type_code))),
    'bed_id',
  );
  const doorDeviceByRoom = new Map();
  for (const device of devices.filter(device => ['201', '202'].includes(normalizeText(device.device_type_code)))) {
    if (!doorDeviceByRoom.has(device.sickroom_id))
      doorDeviceByRoom.set(device.sickroom_id, device);
  }

  const patientsByBedOutCode = new Map();
  const patientsByBedCode = new Map();
  for (const patient of patients.filter(isActivePatient)) {
    if (patient.bed_out_code && !patientsByBedOutCode.has(patient.bed_out_code))
      patientsByBedOutCode.set(patient.bed_out_code, patient);
    if (patient.bed_out_code && !patientsByBedCode.has(patient.bed_out_code))
      patientsByBedCode.set(patient.bed_out_code, patient);
  }

  const latestVitalsBySerial = new Map(vitals.map(item => [item.sick_serial_no, item]));
  const riskBySerial = new Map();
  for (const risk of risks) {
    const list = riskBySerial.get(risk.sick_serial_no) || [];
    if (list.length < 6)
      list.push(risk);
    riskBySerial.set(risk.sick_serial_no, list);
  }

  const callDeviceCodes = new Set(
    calls
      .filter(call => normalizeText(call.event_status) === '0')
      .flatMap(call => [call.call_from, call.call_to].map(normalizeText).filter(Boolean)),
  );
  const alarmBedIds = new Set(
    alarms
      .filter(alarm => normalizeText(alarm.event_status) === '0')
      .map(alarm => Number(alarm.bed_id))
      .filter(Boolean),
  );

  const bedsByRoom = groupBy(beds, 'sickroom_id');
  const roomsPayload = rooms.map((room) => {
    const roomBeds = bedsByRoom.get(room.id) || [];
    const doorDevice = doorDeviceByRoom.get(room.id) || (devicesByRoom.get(room.id) || [])[0];
    return {
      sickroomName: normalizeText(room.sickroom_name, `病房${room.id}`),
      sickroomCode: normalizeText(room.sickroom_code, String(room.id)),
      sickroomId: String(room.id),
      deviceCode: normalizeText(doorDevice?.device_code, `ROOM-${room.id}`),
      templateId: Number(doorDevice?.template_id || area.door_template_id || undefined) || undefined,
      director: '0',
      deviceName: normalizeText(doorDevice?.device_name, '病房门口机'),
      deviceIp: normalizeText(doorDevice?.device_ip),
      doorStaff: {
        areaDirectorName: normalizeText(area.area_director_no),
        areaHeadNurseName: normalizeText(area.area_head_nurse_no),
      },
      doorDeptUsers: [],
      beds: roomBeds.map((bed, index) => {
        const bedDevice = (bedDevicesByBed.get(bed.id) || [])[0];
        const patient = patientsByBedOutCode.get(bed.bed_out_code) || patientsByBedCode.get(bed.bed_code);
        const latestVital = patient ? latestVitalsBySerial.get(patient.sick_serial_no) : undefined;
        const patientRisks = patient ? (riskBySerial.get(patient.sick_serial_no) || []) : [];
        const labels = patientRisks.map(risk => ({
          labelCode: normalizeText(risk.high_risk_type, 'risk'),
          labelName: normalizeText(risk.high_risk_type, '高危'),
          labelColor: '#fff1ed',
          labelTextColor: '#9b3f2d',
        }));
        const isCalling = callDeviceCodes.has(normalizeText(bedDevice?.device_code)) || alarmBedIds.has(Number(bed.id));
        return {
          bedCode: normalizeText(bed.bed_code, String(bed.id)),
          bedName: normalizeText(bed.bed_name, `床位${index + 1}`),
          deviceCode: normalizeText(bedDevice?.device_code, `BED-${bed.id}`),
          position: getBedPosition(index, roomBeds.length),
          isOccupied: !!patient,
          templateId: Number(bedDevice?.template_id || area.bed_template_id || undefined) || undefined,
          nursingColor: mapNursingColor(patient?.nursing_level),
          nursingLevel: normalizeText(patient?.nursing_level),
          sickInfo: patient
            ? {
                bedCode: normalizeText(bed.bed_code, String(bed.id)),
                bedName: normalizeText(bed.bed_name),
                sickName: maskName(patient.sick_name),
                sickSex: normalizeText(patient.sick_sex),
                sickAge: normalizeText(patient.sick_age),
                sickBirthday: formatDateTime(patient.sick_birthday).slice(0, 10),
                sickNo: normalizeText(patient.sick_no),
                sickInTime: formatDateTime(patient.sick_in_time),
                nursingLevel: normalizeText(patient.nursing_level),
                nursingColor: mapNursingColor(patient.nursing_level),
                sickAllergy: normalizeText(patient.sick_allergy),
                sickIsolation: normalizeText(patient.sick_isolation),
                sickDiet: normalizeText(patient.sick_diet),
                sickSafetyPrecautions: normalizeText(patient.sick_safety_precautions),
                visitDoctorName: normalizeText(patient.visit_doctor_no),
                visitDoctorUserDuty: '',
                visitDoctorUserProfessional: '',
                dutyNurseName: normalizeText(patient.duty_nurse_no || bed.duty_nurse_no),
                dutyNurseUserProfessional: '',
                visitDoctorUserRemark: normalizeText(patient.clinical_diagnosis_name || patient.diagnosis_name),
                dutyNurseUserRemark: '',
                visitDoctorUserPic: '',
                dutyNurseUserPic: '',
                areaHeadNurseName: normalizeText(area.area_head_nurse_no),
                areaHeadNurseUserPic: '',
                nursingLabels: labels,
              }
            : undefined,
          statusBarInfo: {
            bedCode: normalizeText(bed.bed_code, String(bed.id)),
            deviceCode: normalizeText(bedDevice?.device_code, `BED-${bed.id}`),
            status: statusCodeFromDevice(bedDevice),
          },
          nursingLabels: labels,
          isOnline: bedDevice ? bedDevice.is_online === '1' : true,
          isCalling,
          latestVitals: latestVital
            ? {
                temp: latestVital.temp,
                pulse: latestVital.pulse,
                breath: latestVital.breath,
                bloodPressure: latestVital.blood_pressure,
                bloodSugar: latestVital.blood_sugar,
                recordTime: formatDateTime(latestVital.record_time),
              }
            : undefined,
        };
      }),
    };
  });

  const history = [
    ...calls.slice(0, 12).map(call => ({
      id: `call-${call.id}`,
      time: formatDateTime(call.call_start_time).slice(11, 19) || '',
      category: 'call',
      bedCode: normalizeText(call.call_from),
      bedName: normalizeText(call.call_from),
      label: normalizeText(call.call_message || call.call_mode_code, '呼叫事件'),
      roomName: '',
    })),
    ...alarms.slice(0, 12).map(alarm => ({
      id: `alarm-${alarm.id}`,
      time: formatDateTime(alarm.alarm_start_time).slice(11, 19) || '',
      category: 'call',
      bedCode: normalizeText(alarm.device_code),
      bedName: normalizeText(alarm.device_code),
      label: normalizeText(alarm.alarm_type, '报警事件'),
      roomName: '',
    })),
  ].slice(0, 24);

  return {
    area: {
      areaName: normalizeText(area.area_name),
      areaCode: normalizeText(area.area_code),
      deptName: normalizeText(area.dept_name, '智慧病区'),
      rooms: roomsPayload,
    },
    deviceCodes: devices.map(device => normalizeText(device.device_code)).filter(Boolean),
    history,
    hospitalInfo,
    warnings: [
      `数据源：dnk_swp_db / ${normalizeText(area.area_name)}`,
      MASK_PATIENT_NAME ? '患者姓名已默认脱敏，可通过 DB_MASK_PATIENT_NAME=false 关闭。' : '',
    ].filter(Boolean),
    fetchedAt: new Date().toISOString(),
  };
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!map.has(value))
      map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

async function handle(req, res) {
  if (req.method === 'OPTIONS')
    return json(res, 204, {});

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      await query('SELECT 1 ok');
      return json(res, 200, { ok: true, database: process.env.DB_NAME || 'dnk_swp_db' });
    }

    if (req.method === 'POST' && url.pathname === '/auth/login') {
      const body = await readJson(req);
      const data = await authService.login(body, { ip: requestIp(req) });
      return json(res, 200, { data });
    }

    if (req.method === 'POST' && url.pathname === '/auth/role-confirm') {
      const token = authService.bearerToken(req.headers.authorization);
      const body = await readJson(req);
      const data = await authService.confirmRole(token, body.roleId);
      return json(res, 200, { data });
    }

    const sessionToken = authService.bearerToken(req.headers.authorization);

    if (req.method === 'GET' && url.pathname === '/api/areas')
      return json(res, 200, { data: await authService.listAuthorizedAreas(sessionToken) });

    if (req.method === 'GET' && url.pathname === '/api/hospital') {
      await authService.verifySession(sessionToken);
      return json(res, 200, { data: await getHospitalInfo() });
    }

    const templateMatch = url.pathname.match(/^\/api\/templates\/([^/]+)$/);
    if (req.method === 'GET' && templateMatch) {
      await authService.verifySession(sessionToken);
      return json(res, 200, { data: await getTemplate(decodeURIComponent(templateMatch[1])) });
    }

    const match = url.pathname.match(/^\/api\/areas\/([^/]+)\/twin$/);
    if (req.method === 'GET' && match) {
      const areaCode = decodeURIComponent(match[1]);
      await authService.assertAreaAccess(sessionToken, areaCode);
      return json(res, 200, { data: await getTwin(areaCode) });
    }

    return notFound(res);
  }
  catch (error) {
    return errorJson(res, error);
  }
}

const server = http.createServer(handle);
server.listen(PORT, HOST, () => {
  console.log(`[db-adapter] http://${HOST}:${PORT}`);
  console.log(`[db-adapter] default area: ${DEFAULT_AREA_CODE}`);
  if (!configuredAuthSecret)
    console.warn('[db-adapter] DB_AUTH_SECRET is not configured; sessions will reset when the adapter restarts');
});

process.on('SIGINT', async () => {
  await pool.end();
  server.close(() => process.exit(0));
});
