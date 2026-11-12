# NetWatch Local — Docker cho Raspberry Pi và Home Assistant OS

Bản chuyển NetWatch hiện có sang tiến trình Node.js và SQLite cục bộ. Giữ giao diện React/React Flow, dự án RB5009/E50UG, sơ đồ tự bố trí hoặc kéo tay, neo/điểm uốn, switch ảo, thiết bị ghim, alias, dây tím/đỏ và toàn màn hình. Không tự thêm mọi thiết bị vào sơ đồ. Dữ liệu thiết bị vẫn do script router gửi lên; đây không phải bản đổi sang polling RouterOS API hay bản MikroDash.

**Chọn một cách cài:** Pi đang chạy HAOS → ưu tiên add-on Supervisor ở phần 5. `docker run` ở phần 4 chỉ dùng nếu đã có shell truy cập Docker của máy chủ, không phải Terminal add-on thông thường.

## 1. Nền tảng được hỗ trợ (1.0.4)

NetWatch có ba cách chạy:

- **Home Assistant OS:** cài add-on. Supervisor tự tải đúng image ARM64/ARMv7.
- **Windows 10/11 x64:** tải gói portable `netwatch-windows-x64-1.0.4.zip` ở [GitHub Releases](https://github.com/phuongtrangpt/netwatch/releases/latest), giải nén và mở `Start-NetWatch.bat`. Gói gồm Node.js và thư viện SQLite, không cần Docker/Node cài sẵn. Mật khẩu Admin được hỏi kín ở lần chạy đầu; dữ liệu nằm trong thư mục `data` bên cạnh gói.
- **Docker Desktop trên Windows/macOS hoặc Docker Engine trên Linux:** dùng image đa kiến trúc `ghcr.io/phuongtrangpt/netwatch:1.0.4`. Docker tự chọn `linux/amd64`, `linux/arm64` hoặc `linux/arm/v7`. Mac Apple Silicon chạy ARM64, Intel/PC x86-64 chạy AMD64.

Với bản Windows, mở `http://localhost:8080`. Để router khác gửi dữ liệu vào máy Windows, cho phép TCP 8080 trên mạng Private của Windows Firewall và dùng IP LAN của máy. Khi cập nhật, dừng ứng dụng, sao lưu thư mục `data`, giải nén gói mới vào cùng chỗ và giữ nguyên `data`.

## 2. Trong bộ mã này có gì?

```
Dockerfile                   Build nhiều giai đoạn; mặc định node:22-alpine
.dockerignore                Không đóng gói .env, dữ liệu, node_modules của Windows
.env.example                 Mật khẩu và URL nhận dữ liệu
compose.yaml                 Tùy chọn cho hệ có Docker Compose
server/                      HTTP, đăng nhập một chủ, SQLite tương thích API hiện có
app/ lib/                    Giao diện và logic NetWatch được giữ lại
scripts/start.mjs            Đọc options.json của HAOS nếu có
scripts/export-cloud.js      Xuất dữ liệu khả dụng từ web cũ
scripts/import-cloud.mjs      Nhập cấu hình vào database mới trên Pi
ha-addon/netwatch/config.yaml Cấu hình Supervisor kéo image đã build
```

Nguồn cơ sở: NetWatch commit `a6eeb9c6127b132f09ad2f33fd7d8f5d46261404`. Đây là bản đóng gói riêng; chưa sửa hay thay thế web đang chạy.

Ứng dụng nghe cổng **8080**. `/data/netwatch.db` lưu dự án, cấu hình WAN, thiết bị ghim/alias, vị trí, neo/điểm uốn, số liệu và lịch sử. SQLite dùng WAL; không sao chép riêng file .db trong lúc ứng dụng đang ghi. `/data/auth.json` lưu hash mật khẩu và khóa phiên. Khi khởi động lại hoặc thay container, phải dùng lại đúng volume. Lịch sử hiện được dọn theo logic bản gốc (khoảng 7 ngày), giao diện truy vấn tối đa 24 giờ.

Dockerfile mặc định `node:22-alpine`, có manifest chính thức cho amd64, ARM64 và ARMv7. Node.js 24 Alpine hiện không cung cấp ARMv7 nên không phù hợp làm base chung cho các Pi ARM32. Gói Windows portable dùng Node.js 24 LTS riêng. Không đưa `.env`, mật khẩu, database hoặc token router vào image.

## 3. Chuẩn bị Windows 11

1. Cài Docker Desktop, bật backend WSL2, chọn **Linux containers** và mở Docker Desktop.
2. Giải nén bộ mã, mở PowerShell tại thư mục có Dockerfile.
3. Chạy các lệnh sau, mỗi lệnh trên một dòng:

```powershell
docker version
docker buildx version
docker buildx create --name netwatch-builder --driver docker-container --use
docker buildx inspect --bootstrap
docker buildx imagetools inspect node:22-alpine
```

Nếu builder đã tồn tại, dùng `docker buildx use netwatch-builder` thay lệnh create. Docker Desktop thường có sẵn khả năng giả lập ARM. Không chép `node_modules` từ Windows vào image: module SQLite được cài/biên dịch trong từng kiến trúc đích.

## 4. Build đa kiến trúc

### A. Docker Hub — một tag dùng cho ba kiến trúc

Thay `YOUR_DOCKERHUB_USER` bằng tên tài khoản Docker Hub viết thường, tạo repository `netwatch`. Lệnh login yêu cầu thông tin tài khoản/token trên máy bạn; không gửi token trong cuộc trò chuyện.

```powershell
docker login -u YOUR_DOCKERHUB_USER
docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 -t YOUR_DOCKERHUB_USER/netwatch:1.0.4 --push .
docker buildx imagetools inspect YOUR_DOCKERHUB_USER/netwatch:1.0.4
```

Kết quả inspect của bản 1.0.4 có `linux/amd64`, `linux/arm64` và `linux/arm/v7`. Docker trên Pi sẽ tự kéo bản phù hợp. Build module SQLite dưới giả lập có thể mất khá lâu. Không ép stage dependencies chạy trên BUILDPLATFORM vì binary SQLite sẽ sai kiến trúc.

Trước khi đổi base image, inspect manifest; ví dụ `node:24-alpine` hiện không có ARMv7 và sẽ làm mất khả năng build cho Pi ARM32:

```powershell
docker buildx imagetools inspect node:22-alpine
docker buildx imagetools inspect node:24-alpine
```

### B. GitHub Container Registry

Tạo token GitHub có quyền ghi packages phù hợp. Nhập token ở lời nhắc mật khẩu của Docker, không lưu token trong Dockerfile. Dùng toàn bộ tên image viết thường.

```powershell
docker login ghcr.io -u YOUR_GITHUB_USER
docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 -t ghcr.io/YOUR_GITHUB_USER/netwatch:1.0.4 --push .
docker buildx imagetools inspect ghcr.io/YOUR_GITHUB_USER/netwatch:1.0.4
```

Image private cần đăng nhập registry trên máy kéo image; với HAOS cần cấu hình registry của Supervisor. Dùng image public không chứa dữ liệu/secret là cách đơn giản hơn cho add-on cá nhân.

### C. Không dùng registry: xuất Docker image .tar

Xuất **mỗi kiến trúc một file**, dùng `type=docker`; không dùng `type=tar` (chỉ xuất filesystem, không phải image để docker load).

```powershell
docker buildx build --platform linux/amd64 -t netwatch:1.0.4 --provenance=false --output type=docker,dest=netwatch-amd64.tar .
docker buildx build --platform linux/arm64 -t netwatch:1.0.4 --provenance=false --output type=docker,dest=netwatch-arm64.tar .
docker buildx build --platform linux/arm/v7 -t netwatch:1.0.4 --provenance=false --output type=docker,dest=netwatch-armv7.tar .
```

Máy Windows/macOS dùng image Docker `linux/amd64` hoặc `linux/arm64` theo Docker Desktop. Pi/HAOS aarch64 dùng arm64; `armv7l` dùng arm/v7. Windows portable ZIP chỉ dành cho x64.

Nếu đã bật SSH **host** HAOS qua khóa SSH theo tài liệu chính thức (cổng 22222), ví dụ chuyển bản ARM64:

```powershell
scp -P 22222 .\netwatch-arm64.tar root@IP_CUA_PI:/mnt/data/netwatch-arm64.tar
```

Trên host Pi:

```sh
docker load -i /mnt/data/netwatch-arm64.tar
docker image inspect netwatch:1.0.4 --format '{{.Os}}/{{.Architecture}}'
```

Luồng .tar này phù hợp Docker thủ công. Với add-on dùng config `image:`, hãy build/push registry; không giả định một image đã load thủ công sẽ được Supervisor nhận là bản add-on đã cài.

## 5. Lệnh docker run — chỉ tại shell Docker của máy chủ

**Không copy mù vào Terminal & SSH thông thường của HAOS.** Add-on Terminal chạy trong container riêng và có thể không có lệnh Docker hoặc quyền docker.sock. Kiểm tra `docker version`: phải hiện cả Client và Server. Không cần tắt Protection mode để cài NetWatch bằng luồng add-on phần 5.

Nếu dùng HAOS host, đây là container tự quản ngoài Supervisor; Supervisor không quản lý cập nhật hay backup dữ liệu của container này. Bật host SSH là thao tác nâng cao theo tài liệu chính thức. Nếu không quen, chọn phần 5.

Sau khi image đã load từ .tar, lệnh dưới đây dùng được. **Thay mật khẩu và IP ví dụ trước khi chạy.** Mật khẩu ít nhất 12 ký tự. IP là IP LAN/VPN cố định của Pi mà router có thể truy cập, không dùng localhost và không dùng URL Ingress.

```sh
docker volume create my-netmon-data
docker run -d --name netwatch --restart unless-stopped -p 8080:8080 -v my-netmon-data:/data -e NETWATCH_PASSWORD='THAY_BANG_MAT_KHAU_RIENG_12_KY_TU_TRO_LEN' -e NETWATCH_INGEST_URL='http://192.168.1.50:8080' --log-driver json-file --log-opt max-size=5m --log-opt max-file=3 netwatch:1.0.4
```

Nếu dùng registry, thay image cuối lệnh bằng `YOUR_DOCKERHUB_USER/netwatch:1.0.4` hoặc `ghcr.io/YOUR_GITHUB_USER/netwatch:1.0.4`. Docker tự pull nếu chưa có image; private registry cần `docker login` trước.

Mở `http://IP_CUA_PI:8080` bằng trình duyệt, nhập mật khẩu đã đặt.

```sh
docker ps --filter name=netwatch
docker logs --tail 100 netwatch
docker inspect netwatch --format '{{.State.Health.Status}}'
```

`unless-stopped` khởi động lại khi process thoát/host reboot, trừ container đã bị stop thủ công. Healthcheck báo unhealthy không tự khởi động lại Docker container; HA Watchdog ở luồng add-on có cơ chế quản lý riêng.

Không cần `--privileged`, `--network host`, Docker socket hoặc bind mount `/share`. Chỉ cổng 8080 nhận web và dữ liệu router. Nếu đổi host port, ví dụ `-p 3000:8080`, phải đổi `NETWATCH_INGEST_URL` thành `http://IP_PI:3000`.

HTTP trong ví dụ dành cho LAN/VPN tin cậy. Không mở cổng 8080 trực tiếp ra Internet; truy cập ngoài nhà bằng VPN hoặc reverse proxy HTTPS. Nếu proxy chấm dứt TLS, đặt `NETWATCH_PUBLIC_URL=https://ten-mien-cua-ban` đúng URL ngoài (không có đường dẫn) để kiểm tra Origin hoạt động. Cookie tự bật Secure khi URL này là HTTPS; proxy cần giữ Host phù hợp. Bản này không có tự cấp chứng chỉ TLS.

## 6. Cài online qua kho add-on GitHub

Xem [hướng dẫn cài đặt hiện hành](../README.md) và [cấu hình NetWatch](../netwatch/DOCS.md).
Kho đã cấu hình image `ghcr.io/phuongtrangpt/netwatch`, không cần sửa placeholder Docker Hub.
Supervisor tự quản lý /data, khởi động và backup của add-on. Không dùng lệnh docker run
để tạo thêm một container trùng với add-on. /share chỉ được truy cập nếu có mapping phù hợp;
ứng dụng này không cần /share.

## 7. Chuyển từ web cũ sang Pi

Không có tự động sao chép database Cloudflare/D1 từ web cũ sang volume. Hai bản lưu riêng. Các bước:

1. Giữ web cũ cho đến khi kiểm tra xong bản Pi.
2. Nếu cần giữ sơ đồ: mở web cũ trên Windows đã đăng nhập, mở DevTools Console, xem và chạy nội dung `scripts/export-cloud.js`. Nó chỉ đọc `/api/projects` và `/api/dashboard`, tải `netwatch-cloud-export.json`.
3. Khởi động bản Pi một lần để tạo bảng. Chưa ghép router/chưa cấu hình dự án mới trên Pi. Với Docker thủ công:

```sh
docker cp netwatch-cloud-export.json netwatch:/data/netwatch-cloud-export.json
docker exec --user node netwatch node scripts/import-cloud.mjs /data/netwatch-cloud-export.json
```

Lệnh import chỉ nhận database chưa có settings/router để tránh ghi đè dữ liệu hiện tại; chạy một lần. Nó giữ dự án, sơ đồ, alias và lịch sử có trong file. API cũ chỉ trả tối đa **24 giờ**: không tuyên bố đây là toàn bộ lịch sử 7 ngày. Không nhập token/router metrics cũ. File xuất chứa thông tin mạng riêng, không đưa lên registry.

Với add-on HAOS, đường thao tác dữ liệu app riêng khác Docker thủ công; không có nút import trên giao diện bản này. Nếu không có host shell để chạy import vào container add-on, cần hỗ trợ chuyển dữ liệu riêng hoặc dựng lại sơ đồ thủ công. Không copy lệnh `docker exec netwatch` vì tên container Supervisor khác.

4. Trên web Pi, chọn từng dự án → Kết nối router → tạo bộ cài `.rsc` mới, dùng URL LAN/VPN của Pi. Tải và import trên đúng router (RouterOS 7.17+). Script dùng lại tên `netwatch-collect`; xem trước nội dung, không chạy đồng thời hai lịch collector. Bộ cài cục bộ không dùng header/token của ChatGPT Sites.
5. Theo dõi Last seen, dữ liệu cổng, DHCP/PPPoE, vị trí sơ đồ và trạng thái ping. Khi Pi nhận ổn định mới ngừng sử dụng web cũ.

Không cần mở RouterOS API 8728 cho phiên bản Docker này: giữ cơ chế push đang dùng. Các E50UG ở nơi khác phải có đường tới Pi qua VPN/site-to-site; đóng Docker không tự tạo đường VPN đó. Router vẫn cần quyền fetch/scheduler trong device-mode như bản cũ.

## 8. Backup, cập nhật và mật khẩu

Docker thủ công — backup toàn volume khi ứng dụng đã dừng, để SQLite/WAL và auth nhất quán:

```sh
mkdir -p /mnt/data/netwatch-backups
docker stop netwatch
docker run --rm -v my-netmon-data:/data:ro -v /mnt/data/netwatch-backups:/backup alpine:3.22 tar -czf /backup/netwatch-data.tar.gz -C /data .
docker start netwatch
```

Lưu file backup sang máy khác. Khi cập nhật image: backup trước, pull/load tag mới, dừng và xóa **container** cũ, chạy lại với cùng `-v my-netmon-data:/data`. Không xóa volume. `docker compose down -v` cũng xóa dữ liệu nên không dùng cho cập nhật. Với HAOS add-on, dùng backup/update qua Supervisor.

Mật khẩu được khởi tạo ở lần chạy đầu; đổi biến môi trường không tự thay mật khẩu đã lưu. Muốn đặt lại trong Docker thủ công, chuẩn bị giá trị NETWATCH_PASSWORD mới trong cấu hình container trước, sao lưu dữ liệu rồi:

```sh
docker stop netwatch
docker run --rm -v my-netmon-data:/data alpine:3.22 rm /data/auth.json
```

Sau đó tạo lại container với cùng volume và mật khẩu mới, khởi động. Chỉ xóa `auth.json`, KHÔNG xóa database. Khóa phiên sẽ đổi, phiên đăng nhập cũ hết hiệu lực. Với HAOS add-on cần thao tác đúng dữ liệu app riêng; không xóa tùy tiện thư mục HA.

## 9. Kiểm tra đã thực hiện và giới hạn

Đã cài dependency, build frontend/server và chạy 32 kiểm tra trên Linux x86_64 với Node 24 của môi trường soạn mã. Kiểm tra gồm logic định tuyến dây/neo/vị trí, xác thực cục bộ, chặn header giả/CSRF, tạo bộ cài, ingest, migration bảng, lưu alias/ghim/tọa độ/history, khởi động lại đọc SQLite và nhập dữ liệu cloud không ghi đè.

Bản Windows portable được tạo và smoke test trên runner Windows x64 trong GitHub Actions. Image Docker được build cho linux/amd64, linux/arm64 và linux/arm/v7; CI khởi động thử ARM64/ARMv7. Windows ARM và kiểm tra cài thực tế trên mọi bản phân phối macOS/Linux cần Docker Desktop/Engine tương ứng.

Nguồn chính thức:
- https://docs.docker.com/build/building/multi-platform/
- https://docs.docker.com/build/exporters/oci-docker/
- https://contributors.home-assistant.io/os/operating-system/debugging/
- https://contributors.home-assistant.io/apps/reference/configuration/
- https://contributors.home-assistant.io/apps/guides/ingress/
- https://nodejs.org/en/about/eol
