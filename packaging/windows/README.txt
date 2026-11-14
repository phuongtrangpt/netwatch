NETWATCH PORTABLE — WINDOWS 10/11 x64

1. Giai nen toan bo thu muc vao noi ban muon luu du lieu, vi du C:\NetWatch.
2. Mo Start-NetWatch.bat. Lan dau, nhap mat khau Admin it nhat 12 ky tu khi duoc hoi.
   Mat khau duoc nhap an, khong hien tren man hinh. NetWatch khong co mat khau mac dinh.
3. Mo trinh duyet tai http://localhost:8080 va dang nhap bang admin va mat khau vua tao.
4. Du lieu, tai khoan va so do duoc luu trong thu muc data nam canh file chay.

CAP NHAT TU BAN CU (GIU NGUYEN DU LIEU)
1. Dung NetWatch bang Ctrl+C trong cua so dang chay.
2. Sao luu toan bo thu muc NetWatch cu, dac biet thu muc data.
3. Tai ZIP Windows x64 tu https://github.com/phuongtrangpt/netwatch/releases/latest
   Khong tai "Source code". Giai nen vao mot thu muc moi.
4. Chep toan bo thu muc data tu ban cu sang thu muc moi, nam canh Start-NetWatch.bat.
   Neu da sua start-netwatch.ps1 hoac dung bien moi truong PORT, NETWATCH_PUBLIC_URL,
   NETWATCH_INGEST_URL, hay chuyen lai cac tuy chinh do. Giu nguyen IP may chu va cong.
5. Chay Start-NetWatch.bat trong thu muc moi. Neu hoi tao lai mat khau thi dung lai
   va kiem tra da chep dung data/auth.json chua. Khong tao mat khau moi.
6. Mo dia chi cu, nhan Ctrl+F5, dang nhap va kiem tra du an/so do/du lieu router.
7. Neu can quay lai: dung ban moi, chay ban cu voi ban sao data truoc cap nhat.

De chay tren LAN, cho phep Windows Firewall truy cap mang Private cho NetWatch
(TCP 8080), roi dung http://IP_MAY_TINH:8080.

Goi nay danh cho Windows 10/11 64-bit x86. Windows ARM, macOS va Linux co the chay
image Docker da phat hanh (linux/amd64, linux/arm64, linux/arm/v7) bang Docker Desktop/Engine.
Khong chia se thu muc data vi no chua thong tin dang nhap va cau hinh mang.

CAP NHAT TREN WEB (TU 1.0.17)
Sau khi cai goi day du 1.0.17, vao Thong tin trang de kiem tra va cap nhat ban moi.
Lan dang nhap quan tri se tu kiem tra va hoi khi co ban moi. Chi cai khi ban dong y.
Goi duoc kiem tra SHA-256; du lieu duoc sao luu sau khi dung ung dung.
Neu ban moi khong khoi dong duoc, trinh cap nhat phuc hoi ban cu va du lieu.
Khong tat may khi cap nhat. Cua so ung dung moi can duoc giu khi su dung.
Ban sao luu va log nam trong data/updates; khong chia se thu muc nay.
