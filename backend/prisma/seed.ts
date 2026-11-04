// Demo data (docs/spec.md §8). Dates are relative to the seed run so overdue / late states always exist.
//   ts-node prisma/seed.ts            wipe + seed
//   ts-node prisma/seed.ts --if-empty seed only when there are no users
import { EdgeDirection, NodeKind, PrismaClient, ProductStatus, TaskPriority, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const TZ = process.env.APP_TIMEZONE ?? 'Asia/Ho_Chi_Minh';
const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const day = (offset: number) => {
  const d = new Date(`${todayStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const ago = (days: number, hour = 9) => new Date(Date.now() - days * 86_400_000 + (hour - 12) * 3_600_000);

// Status scenarios cycled across tasks: [status, deadline offset (days) | null, completed days ago]
const SCENARIOS: [TaskStatus, number | null, number?][] = [
  ['COMPLETED', -20, 22], // on time
  ['IN_PROGRESS', 7],
  ['COMPLETED', -10, 4], // late
  ['TODO', 14],
  ['REVIEW', 3],
  ['IN_PROGRESS', -3], // overdue
  ['COMPLETED', 5, 2], // early
  ['TODO', -6], // overdue
  ['TODO', null],
  ['IN_PROGRESS', 0], // due today, not overdue
  ['COMPLETED', -35, 36],
  ['REVIEW', -1], // overdue
];
const PRIORITIES: TaskPriority[] = ['MEDIUM', 'HIGH', 'LOW', 'URGENT', 'MEDIUM', 'HIGH'];

const PHANTOM_FEATURES: Record<string, Record<string, string[]>> = {
  Hardware: {
    'Thiết kế PCB': ['Vẽ schematic mạch chính', 'Layout PCB 4 lớp', 'Đặt mạch mẫu và kiểm tra'],
    'ESP32 Firmware': ['Cấu hình bootloader ESP32', 'Viết driver ngoại vi', 'Tối ưu tiêu thụ điện'],
    'GPS Positioning': ['Tích hợp module GPS', 'Lọc nhiễu tọa độ', 'Kiểm thử ngoài trời'],
    'LTE/eSIM': ['Chọn module LTE', 'Kích hoạt eSIM', 'Kiểm thử chuyển vùng mạng'],
    'Battery Management': ['Thiết kế mạch sạc', 'Đo thời lượng pin', 'Bảo vệ quá nhiệt'],
  },
  Firmware: {
    'Wi-Fi Communication': [
      'Tối ưu kết nối Wi-Fi',
      'Kiểm tra khoảng cách kết nối',
      'Đo tốc độ truyền dữ liệu',
      'Kiểm tra khả năng tự kết nối lại',
      'Kiểm thử khi mất mạng',
    ],
    'MQTT Communication': ['Kết nối broker qua TLS', 'Định nghĩa cấu trúc topic', 'Xử lý mất kết nối broker'],
    'Audio Recording': ['Cấu hình microphone I2S', 'Ghi âm định dạng WAV', 'Lập lịch ghi âm'],
    'File Synchronization': ['Đồng bộ file theo lô', 'Kiểm tra toàn vẹn bằng checksum', 'Mã hóa file khi truyền'],
  },
  Backend: {
    'Device Management API': ['Thiết kế API quản lý thiết bị', 'CRUD thiết bị', 'Phân quyền truy cập thiết bị'],
    Authentication: ['Đăng nhập bằng JWT', 'Xác thực thiết bị bằng chứng chỉ'],
    'MQTT Broker': ['Triển khai EMQX', 'Giám sát broker', 'Cấu hình ACL theo thiết bị'],
    'Data Storage': ['Thiết kế schema lưu trữ', 'Lưu file âm thanh lên object storage', 'Chính sách lưu giữ dữ liệu'],
  },
  Frontend: {
    'Device Dashboard': ['Màn hình danh sách thiết bị', 'Bản đồ vị trí thiết bị'],
    'Live Monitoring': ['Hiển thị trạng thái realtime', 'Cảnh báo mất kết nối'],
    'Audio Playback': ['Trình phát âm thanh trên web', 'Tải xuống bản ghi'],
    'Device Configuration': ['Form cấu hình thiết bị', 'Đẩy cấu hình qua MQTT'],
  },
};

const OTHER_FEATURES: Record<string, [string, string][]> = {
  Veronica: [['AI', 'Speech Recognition'], ['AI', 'NLU Engine'], ['AI', 'Voice Synthesis'], ['Frontend', 'Admin Console']],
  'Veronica Hub': [['Backend', 'Device Gateway'], ['Backend', 'Message Queue'], ['Backend', 'User Management'], ['DevOps', 'Monitoring']],
  'AI Agent': [['AI', 'Task Planner'], ['AI', 'Tool Integration'], ['Backend', 'Memory Store']],
  'Chatbot AI': [['AI', 'Dialog Manager'], ['AI', 'Knowledge Base'], ['Frontend', 'Web Widget'], ['Backend', 'Analytics']],
  'Neo Vision Pro': [['Hardware', 'Camera Pipeline'], ['AI', 'Object Detection'], ['DevOps', 'Edge Deployment']],
  'Vali Denoise': [['AI', 'Noise Model'], ['Firmware', 'Realtime DSP'], ['QA', 'Evaluation Suite']],
  'Smart Canteen': [['Frontend', 'Ordering App'], ['Backend', 'Payment'], ['Frontend', 'Kitchen Display'], ['Backend', 'Inventory']],
  'SmartICR Post': [['AI', 'OCR Engine'], ['AI', 'Address Parsing'], ['Backend', 'Sorting Integration']],
};
const GENERIC_TASKS = ['Phân tích yêu cầu', 'Thiết kế giải pháp', 'Triển khai', 'Kiểm thử tích hợp'];

const PRODUCTS: { name: string; icon: string; color: string; status: ProductStatus; description: string; start: number; end: number }[] = [
  { name: 'Phantom R3', icon: 'radio', color: '#2563eb', status: 'ACTIVE', start: -120, end: 60, description: 'Thiết bị ghi âm và định vị cầm tay, truyền dữ liệu qua Wi-Fi/LTE, quản lý tập trung trên nền tảng web.' },
  { name: 'Veronica', icon: 'brain-circuit', color: '#7c3aed', status: 'ACTIVE', start: -200, end: 90, description: 'Trợ lý AI giọng nói tiếng Việt cho doanh nghiệp.' },
  { name: 'Veronica Hub', icon: 'server', color: '#0891b2', status: 'ACTIVE', start: -150, end: 45, description: 'Hạ tầng trung tâm kết nối thiết bị và dịch vụ của hệ sinh thái Veronica.' },
  { name: 'AI Agent', icon: 'bot', color: '#16a34a', status: 'PLANNING', start: -30, end: 150, description: 'Tác tử AI tự động hoá quy trình nghiệp vụ với công cụ nội bộ.' },
  { name: 'Chatbot AI', icon: 'message-square', color: '#ea580c', status: 'ACTIVE', start: -90, end: 30, description: 'Chatbot chăm sóc khách hàng đa kênh, tích hợp cơ sở tri thức.' },
  { name: 'Neo Vision Pro', icon: 'scan-eye', color: '#db2777', status: 'ON_HOLD', start: -160, end: 20, description: 'Camera thông minh nhận diện vật thể chạy trên thiết bị biên.' },
  { name: 'Vali Denoise', icon: 'audio-waveform', color: '#0d9488', status: 'ACTIVE', start: -60, end: 75, description: 'Khử nhiễu âm thanh thời gian thực cho thiết bị ghi âm.' },
  { name: 'Smart Canteen', icon: 'utensils', color: '#ca8a04', status: 'ACTIVE', start: -100, end: 40, description: 'Hệ thống căng tin thông minh: đặt món, thanh toán, quản lý kho.' },
  { name: 'SmartICR Post', icon: 'scan-text', color: '#4f46e5', status: 'COMPLETED', start: -300, end: -10, description: 'Nhận dạng ký tự và địa chỉ trên bưu phẩm phục vụ phân loại tự động.' },
];

async function wipe() {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.architectureConnection.deleteMany(),
    prisma.architectureNode.deleteMany(),
    prisma.taskHistory.deleteMany(),
    prisma.taskAttachment.deleteMany(),
    prisma.taskComment.deleteMany(),
    prisma.taskChecklistItem.deleteMany(),
    prisma.task.deleteMany(),
    prisma.feature.deleteMany(),
    prisma.product.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function main() {
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
    console.log('seed: database already has data, skipping');
    return;
  }
  await wipe();

  const hash = (p: string) => bcrypt.hash(p, 10);
  const mk = async (email: string, name: string, role: 'ADMIN' | 'MANAGER' | 'MEMBER', password: string, avatarColor: string) =>
    prisma.user.create({ data: { email, name, role, avatarColor, passwordHash: await hash(password) } });
  const admin = await mk('admin@archboard.local', 'Quản trị viên', 'ADMIN', 'Admin@123', '#18181b');
  const manager = await mk('manager@archboard.local', 'Trần Minh Quân', 'MANAGER', 'Manager@123', '#2563eb');
  const members = [
    await mk('lan@archboard.local', 'Nguyễn Thị Lan', 'MEMBER', 'Member@123', '#db2777'),
    await mk('huy@archboard.local', 'Lê Quang Huy', 'MEMBER', 'Member@123', '#16a34a'),
    await mk('thao@archboard.local', 'Phạm Thu Thảo', 'MEMBER', 'Member@123', '#ea580c'),
    await mk('duc@archboard.local', 'Võ Minh Đức', 'MEMBER', 'Member@123', '#7c3aed'),
  ];
  const people = [...members, manager];

  const products = new Map<string, string>();
  for (const [i, p] of PRODUCTS.entries()) {
    const created = await prisma.product.create({
      data: {
        name: p.name, icon: p.icon, color: p.color, status: p.status, description: p.description,
        ownerId: i === 0 ? manager.id : people[i % people.length].id,
        startDate: day(p.start), deadline: day(p.end), createdAt: ago(-p.start),
      },
    });
    products.set(p.name, created.id);
  }

  let n = 0;
  const addTask = async (featureId: string, title: string, withExtras: boolean) => {
    const [status, deadlineOffset, completedAgo] = SCENARIOS[n % SCENARIOS.length];
    const creator = n % 3 === 0 ? manager : people[n % people.length];
    const assignee = n % 7 === 6 ? null : people[(n + 1) % people.length];
    const deadline = deadlineOffset === null ? null : day(deadlineOffset);
    const completedAt = completedAgo !== undefined ? ago(completedAgo, 16) : null;
    const completedOn = completedAt ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(completedAt) : null;
    const createdAt = ago(30 + ((n * 7) % 50));
    const task = await prisma.task.create({
      data: {
        featureId, title, status, priority: PRIORITIES[n % PRIORITIES.length],
        description: `${title}. Mô tả chi tiết, tiêu chí hoàn thành và ghi chú kỹ thuật cho công việc này.`,
        creatorId: creator.id, assigneeId: assignee?.id ?? null,
        startDate: deadline ? day((deadlineOffset ?? 0) - 10 - (n % 6)) : day(-5),
        deadline, completedAt,
        completedLate: !!(completedOn && deadline && completedOn > deadline.toISOString().slice(0, 10)),
        sortOrder: n, createdAt,
      },
    });
    await prisma.taskHistory.create({ data: { taskId: task.id, actorId: creator.id, action: 'CREATED', createdAt } });
    if (status !== 'TODO') {
      await prisma.taskHistory.create({
        data: {
          taskId: task.id, actorId: (assignee ?? creator).id, action: 'UPDATED', field: 'status',
          oldValue: 'TODO', newValue: status, createdAt: completedAt ?? ago(3),
        },
      });
    }
    if (withExtras) {
      const items = ['Chuẩn bị môi trường kiểm thử', 'Thực hiện và ghi log kết quả', 'Viết báo cáo ngắn'];
      await prisma.taskChecklistItem.createMany({
        data: items.map((t, i) => ({ taskId: task.id, title: t, sortOrder: i, done: status === 'COMPLETED' || i < n % 3 })),
      });
      await prisma.taskComment.create({
        data: { taskId: task.id, authorId: manager.id, body: 'Nhớ cập nhật kết quả đo vào báo cáo tuần nhé.', createdAt: ago(5) },
      });
      if (assignee) {
        await prisma.taskComment.create({
          data: { taskId: task.id, authorId: assignee.id, body: 'Đã nhận, em sẽ cập nhật trước buổi review.', createdAt: ago(4) },
        });
      }
    }
    n++;
  };

  const phantomId = products.get('Phantom R3')!;
  const phantomFeatures = new Map<string, string>();
  for (const [category, features] of Object.entries(PHANTOM_FEATURES)) {
    let order = 0;
    for (const [name, tasks] of Object.entries(features)) {
      const f = await prisma.feature.create({
        data: {
          productId: phantomId, name, category, sortOrder: order++, ownerId: people[order % people.length].id,
          description: `${name} cho thiết bị Phantom R3.`, startDate: day(-90), deadline: day(20 + order * 5),
        },
      });
      phantomFeatures.set(name, f.id);
      for (const t of tasks) await addTask(f.id, t, name === 'Wi-Fi Communication' || name === 'File Synchronization');
    }
  }

  for (const [productName, features] of Object.entries(OTHER_FEATURES)) {
    const productId = products.get(productName)!;
    for (const [i, [category, name]] of features.entries()) {
      const f = await prisma.feature.create({
        data: {
          productId, name, category, sortOrder: i, ownerId: people[(i + 2) % people.length].id,
          description: `${name} — ${productName}.`, startDate: day(-60), deadline: day(15 + i * 10),
        },
      });
      for (const t of GENERIC_TASKS.slice(0, 2 + ((i + productName.length) % 3))) await addTask(f.id, `${t} ${name}`, false);
    }
  }

  // ---- Diagrams -------------------------------------------------------------------------------
  type N = { key: string; kind: NodeKind; ref?: string; label?: string; x: number; y: number; w?: number; h?: number; center?: boolean; feature?: string };
  type E = [string, string, string, string, string, EdgeDirection?]; // source, sHandle, target, tHandle, label, dir
  const diagram = async (owner: string, nodes: N[], edges: E[]) => {
    const productId = products.get(owner)!;
    const ids = new Map(nodes.map((nd) => [nd.key, randomUUID()]));
    await prisma.architectureNode.createMany({
      data: nodes.map((nd) => ({
        id: ids.get(nd.key)!, productId, kind: nd.kind, label: nd.label ?? '',
        refProductId: nd.ref ? products.get(nd.ref)! : null, featureId: nd.feature ? phantomFeatures.get(nd.feature) ?? null : null,
        positionX: nd.x, positionY: nd.y, width: nd.w ?? null, height: nd.h ?? null, isCenter: !!nd.center,
      })),
    });
    await prisma.architectureConnection.createMany({
      data: edges.map(([s, sh, t, th, label, dir]) => ({
        id: randomUUID(), productId, sourceNodeId: ids.get(s)!, targetNodeId: ids.get(t)!,
        sourceHandle: sh, targetHandle: th, label, direction: dir ?? 'FORWARD',
      })),
    });
    await prisma.product.update({ where: { id: productId }, data: { architectureUpdatedAt: new Date() } });
  };

  await diagram(
    'Phantom R3',
    [
      { key: 'center', kind: 'PRODUCT', ref: 'Phantom R3', x: -150, y: -70, center: true },
      { key: 'hub', kind: 'PRODUCT', ref: 'Veronica Hub', x: -110, y: -380 },
      { key: 'agent', kind: 'PRODUCT', ref: 'AI Agent', x: -560, y: -230 },
      { key: 'vision', kind: 'PRODUCT', ref: 'Neo Vision Pro', x: 340, y: -230 },
      { key: 'denoise', kind: 'PRODUCT', ref: 'Vali Denoise', x: -560, y: 130 },
      { key: 'canteen', kind: 'PRODUCT', ref: 'Smart Canteen', x: 340, y: 130 },
      { key: 'chat', kind: 'PRODUCT', ref: 'Chatbot AI', x: -110, y: 300 },
      // Owner's reference diagram (docs/phantom-r3-reference.png)
      { key: 'note', kind: 'NOTE', x: 820, y: -420, w: 380, h: 64, label: 'Thể thức truyền là wifi blockchain và file luôn được mã hóa khi truyền đảm bảo tính toàn vẹn' },
      { key: 'r3a', kind: 'MODULE', label: 'PhantomR3A', x: 820, y: -200, feature: 'Wi-Fi Communication' },
      { key: 'r3b', kind: 'MODULE', label: 'PhantomR3B', x: 1080, y: -200, feature: 'Audio Recording' },
      { key: 'r3c', kind: 'MODULE', label: 'PhantomR3C', x: 1340, y: -200, feature: 'File Synchronization' },
      { key: 'r3v', kind: 'MODULE', label: 'PhantomR3V', x: 1080, y: 60 },
    ],
    [
      ['center', 'top', 'hub', 'bottom', 'MQTT'],
      ['center', 'left', 'agent', 'right', 'API'],
      ['center', 'right', 'vision', 'left', ''],
      ['denoise', 'right', 'center', 'left', 'Audio'],
      ['center', 'right', 'canteen', 'left', ''],
      ['center', 'bottom', 'chat', 'top', '', 'BOTH'],
      ['r3a', 'bottom', 'r3v', 'left', ''],
      ['r3b', 'bottom', 'r3v', 'top', ''],
      ['r3c', 'bottom', 'r3v', 'right', '', 'BOTH'],
      ['r3a', 'top', 'r3b', 'top', 'Wav'],
      ['r3c', 'top', 'r3b', 'top', 'all định dạng'],
    ],
  );
  await diagram(
    'Veronica',
    [
      { key: 'center', kind: 'PRODUCT', ref: 'Veronica', x: -150, y: -70, center: true },
      { key: 'hub', kind: 'PRODUCT', ref: 'Veronica Hub', x: -110, y: -360 },
      { key: 'agent', kind: 'PRODUCT', ref: 'AI Agent', x: -520, y: 60 },
      { key: 'chat', kind: 'PRODUCT', ref: 'Chatbot AI', x: 300, y: 60 },
    ],
    [
      ['center', 'top', 'hub', 'bottom', 'gRPC', 'BOTH'],
      ['center', 'left', 'agent', 'right', ''],
      ['center', 'right', 'chat', 'left', 'NLU'],
    ],
  );

  console.log(`seed: ${await prisma.user.count()} users, ${products.size} products, ${await prisma.feature.count()} features, ${n} tasks (admin ${admin.email} / Admin@123)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
