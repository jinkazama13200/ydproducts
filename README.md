# Yida Products Monitor (Web + Desktop EXE)

## 1) Chạy Web local (Ubuntu/WSL)

### Backend
```bash
cd backend
cp .env.example .env
# sửa PRODUCT_TOKEN trong .env
npm i
npm start
```

### Frontend
```bash
cd ../frontend
npm i
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8787/api/running-products`

---

## 2) Build EXE trên Windows

```bat
cd C:\Users\yd0001\Downloads\ydproducts
npm i
npm --prefix frontend i
npm run desktop:pack-win
```

File cài đặt nằm ở thư mục `dist\`.

---

## 3) Auto Update qua GitHub Releases

Repo update:
- `jinkazama13200/ydproducts`

### Mỗi lần release bản mới:
1. Tăng version trong `package.json` (vd `1.0.1` -> `1.0.2`)
2. Set token GitHub (PAT có scope `repo`)
3. Publish

```bat
cd C:\Users\yd0001\Downloads\ydproducts
set GH_TOKEN=YOUR_GITHUB_TOKEN
npm run desktop:publish-win
```

App đang cài sẽ tự check update khi mở.

---

## 4) Các lệnh chính

```bash
# Build frontend
npm run frontend:build

# Chạy desktop local
npm run desktop:start

# Chạy desktop debug
npm run desktop:start:debug

# Build installer Windows
npm run desktop:pack-win

# Build + publish release Windows
npm run desktop:publish-win
```

---

## 5) Mapping icon mức đơn (hiện tại)

- `>=10 đơn`: `frontend/public/hot-icon.mp4`
- `3–9 đơn`: `frontend/public/warm-icon.mp4`
- `<3 đơn`: `frontend/public/idle-icon.mp4`

Có fallback emoji khi media lỗi:
- `>=10` -> 🔥
- `3–9` -> 🟢
- `<3` -> ⚪

---

## 6) Lưu ý

- Nếu app trắng màn hình khi build EXE: đảm bảo `frontend/vite.config.js` có `base: './'`.
- Nếu icon không hiện: kiểm tra đủ file icon trong `frontend/public` trước khi build.
- Khi publish auto-update: bắt buộc phải tăng version, nếu không app sẽ không báo bản mới.
