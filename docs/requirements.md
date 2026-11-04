# Original requirements (from the product owner, verbatim)

> This is the source brief. `docs/spec.md` records the decisions made on top of it; where they differ, `spec.md` wins.
> Reference diagram drawn by the owner: `docs/phantom-r3-reference.png`.

PROJECT: PRODUCT ARCHITECTURE & TASK MANAGEMENT PLATFORM

1. Mục tiêu dự án
Xây dựng một nền tảng Web quản lý kiến trúc hệ thống và tiến độ phát triển sản phẩm CNTT, kết hợp giữa Draw.io, System Architecture Diagram và Project Management.
Hệ thống cho phép người dùng:
- Quản lý danh sách các sản phẩm CNTT.
- Xây dựng sơ đồ kiến trúc tổng quan của từng sản phẩm.
- Tương tác trực tiếp với từng thành phần trên sơ đồ.
- Quản lý danh sách tính năng (Features) của từng sản phẩm.
- Tạo và giao task cho từng tính năng.
- Theo dõi trạng thái hoàn thành, tiến độ và task quá hạn.
- Theo dõi tổng quan tiến độ phát triển của toàn bộ sản phẩm.
Đây phải là một ứng dụng quản lý sản phẩm thực tế, có dữ liệu và logic hoạt động đầy đủ, không phải giao diện demo tĩnh.

2. Thiết kế giao diện tổng thể
Thiết kế theo phong cách Draw.io kết hợp Linear và Notion.
- Tối giản, hiện đại, chuyên nghiệp.
- Giao diện sáng, nền trắng hoặc xám rất nhạt.
- Màu sắc trung tính, sử dụng màu nhấn có kiểm soát.
- Typography rõ ràng, dễ đọc.
- Các thành phần được căn chỉnh khoa học.
- Không sử dụng gradient sặc sỡ.
- Không lạm dụng hiệu ứng và animation.
- Responsive trên desktop, tablet.
- Ưu tiên trải nghiệm desktop vì đây là công cụ làm việc kỹ thuật.

3. Menu điều hướng
Sidebar bên trái gồm: Dashboard, Products, Architecture, My Tasks, All Tasks, Overdue Tasks, Reports, Settings.
Sidebar có thể thu gọn và mở rộng.

4. Dashboard
Thống kê tổng quan: Tổng số sản phẩm. Tổng số tính năng. Tổng số task. Task đã hoàn thành. Task đang thực hiện. Task chưa thực hiện. Task quá hạn.
Biểu đồ: Tiến độ hoàn thành task theo thời gian. Tỷ lệ hoàn thành của từng sản phẩm. Phân bố task theo trạng thái. Số lượng task quá hạn.
Danh sách sản phẩm dạng card: Tên sản phẩm. Logo hoặc biểu tượng. Mô tả ngắn. Tổng số tính năng. Tổng số task. Phần trăm hoàn thành. Số task quá hạn. Ngày cập nhật gần nhất. Click vào card để mở trang chi tiết sản phẩm.

5. Products – Danh sách sản phẩm
Dữ liệu ban đầu: Phantom R3, Veronica, Veronica Hub, AI Agent, Chatbot AI, Neo Vision Pro, Vali Denoise, Smart Canteen, SmartICR Post.
Cho phép: Thêm sản phẩm. Sửa thông tin sản phẩm. Xóa sản phẩm (có xác nhận). Tìm kiếm sản phẩm. Lọc theo trạng thái. Sắp xếp theo tiến độ hoặc thời gian cập nhật.
Mỗi sản phẩm có một không gian quản lý riêng.

6. Product Architecture – Sơ đồ kiến trúc tương tác (chức năng quan trọng nhất)
Infinite Canvas tương tự Draw.io. Mỗi sản phẩm có một sơ đồ kiến trúc riêng.
Ví dụ: Phantom R3 là sản phẩm trung tâm (kích thước lớn hơn, có tên, biểu tượng, tiến độ tổng thể, trạng thái dự án), xung quanh là các sản phẩm/module liên quan, mỗi thành phần là một node độc lập, có đường kết nối thể hiện quan hệ, mỗi node hiển thị tên và tiến độ.

```
                [Veronica Hub]
   [AI Agent]                    [Neo Vision Pro]
                [Phantom R3]
   [Vali Denoise]                [Smart Canteen]
                [Chatbot AI]
```

Click Phantom R3 → trang chi tiết Phantom R3 (toàn bộ tính năng, tiến độ tổng thể, task liên quan, task quá hạn).
Click sản phẩm nhỏ → trang chi tiết sản phẩm đó (chỉ tính năng và task của sản phẩm đó).
Thao tác canvas: Zoom in/out. Pan. Kéo thả node. Thêm node mới. Xóa node. Kết nối các node. Chỉnh sửa tên node. Lưu vị trí và cấu trúc sơ đồ. Click node để mở chi tiết. Tìm kiếm node.
Thanh công cụ kiểu Draw.io: Select. Hand/Pan. Add Product. Add Connection. Zoom. Fit to Screen. Undo/Redo. Save.

7. Product Detail – Quản lý tính năng
Thông tin sản phẩm: Tên. Mô tả. Người phụ trách. Ngày bắt đầu. Deadline tổng thể. Trạng thái. Tiến độ hoàn thành.
Ví dụ tính năng Phantom R3:
- Hardware: Thiết kế PCB. ESP32 Firmware. GPS Positioning. LTE/eSIM. Battery Management.
- Firmware: Wi-Fi Communication. MQTT Communication. Audio Recording. File Synchronization.
- Backend: Device Management API. Authentication. MQTT Broker. Data Storage.
- Frontend: Device Dashboard. Live Monitoring. Audio Playback. Device Configuration.
Cho phép: Thêm/sửa tên và mô tả/xóa tính năng. Phân loại. Giao người phụ trách. Thiết lập deadline. Theo dõi tiến độ.

8. Task Management
Ví dụ: Phantom R3 → Firmware → Wi-Fi Communication: Tối ưu kết nối Wi-Fi. Kiểm tra khoảng cách kết nối. Đo tốc độ truyền dữ liệu. Kiểm tra khả năng tự kết nối lại. Kiểm thử khi mất mạng.
Task có: Tên. Mô tả chi tiết. Người phụ trách. Người tạo. Ngày bắt đầu. Deadline. Mức độ ưu tiên. Trạng thái. Checklist. File đính kèm. Bình luận. Lịch sử cập nhật.
Trạng thái: Todo, In Progress, Review, Completed, Overdue.
Logic quá hạn: Deadline đã qua và task chưa Completed → tự động Overdue. Task hoàn thành đúng hạn không tính quá hạn. Task quá hạn vẫn có thể chuyển sang In Progress hoặc Completed. Task quá hạn được hoàn thành → lưu trạng thái hoàn thành trễ để báo cáo.
Thao tác: Tạo. Sửa. Xóa. Giao. Đổi trạng thái. Đổi deadline. Đánh dấu hoàn thành. Thêm checklist. Bình luận. Theo dõi lịch sử.

9. Các chế độ hiển thị task (trong mỗi sản phẩm)
List View. Kanban View (kéo thả giữa các trạng thái). Timeline View. Calendar View.
Bộ lọc: người phụ trách, tính năng, trạng thái, độ ưu tiên, thời gian, task quá hạn.

10. Reports
Theo sản phẩm và toàn hệ thống: Tổng số task. Hoàn thành. Chưa hoàn thành. Quá hạn. Tỷ lệ hoàn thành đúng hạn. Hiệu suất hoàn thành theo tuần/tháng. Tiến độ từng tính năng. Tiến độ từng sản phẩm. Khối lượng task theo nhân sự.
Lọc theo thời gian, xuất Excel/PDF.

11. Database
Tối thiểu: users, products, architecture_nodes, architecture_connections, features, tasks, task_checklists, task_comments, task_attachments, task_history, notifications.
Quan hệ: Product → Features → Tasks; Product → Architecture Nodes → Connections; Task → Assignee / Comments / Checklist / History.
Dữ liệu giữa các sản phẩm độc lập, không trùng lặp.

12. Kỹ thuật
Frontend: React/Next.js, TypeScript, Tailwind CSS, Shadcn UI, React Flow (@xyflow/react), Recharts.
Backend: Node.js/NestJS, REST API, PostgreSQL, Prisma ORM.
Infrastructure: Docker/Docker Compose, cấu hình Development và Production.
Phân tách frontend/backend/database. API rõ ràng. Xác thực và phân quyền. Kiểm tra đầu vào. Xử lý lỗi. Lưu dữ liệu thực tế. Không hardcode dữ liệu vào giao diện. Có seed data.

13. Quy tắc UX
Click node sản phẩm mở đúng sản phẩm. Click tính năng mở đúng danh sách task. Thêm task cập nhật ngay số liệu tổng quan. Hoàn thành task cập nhật tiến độ tính năng và sản phẩm. Task quá hạn nhận diện tự động. Đổi deadline cập nhật trạng thái quá hạn. Xóa tính năng cảnh báo về các task liên quan. Sơ đồ lưu được vị trí node và kết nối. Làm mới trang không mất dữ liệu. Dashboard đồng bộ với các màn hình khác.

15. Tiêu chí nghiệm thu
CRUD hoạt động thực tế. Sơ đồ tương tác như công cụ kiến trúc hệ thống. Thêm và kết nối sản phẩm. Nhiều tính năng mỗi sản phẩm. Nhiều task mỗi tính năng. Tiến độ tự tính chính xác. Task quá hạn tự nhận diện. Dashboard đồng bộ. Dữ liệu lưu trong database. Không có nút/chức năng chỉ minh họa.
Ưu tiên chất lượng trải nghiệm, kiến trúc code dễ mở rộng, khả năng triển khai thực tế.

Process requirement from the owner: implement with TDD (`ecc:tdd-workflow`), E2E tests with Playwright (`ecc:e2e-testing`).
