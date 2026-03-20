# Product Monitor React / Desktop

## Web mode (cũ)
### Backend
```bash
cd backend
cp .env.example .env
npm i
npm start
```

### Frontend
```bash
cd ../frontend
npm i
npm run dev
```

## Desktop EXE mode (mới)
> Dùng cho PC khác, mở app trực tiếp.

```bash
cd product-monitor-react
npm i
npm run frontend:build
npm run desktop:pack-win
```

File cài đặt sẽ nằm trong thư mục `dist/` (NSIS `.exe`).

### Notes
- App desktop tự gọi API trực tiếp (không cần PM2/backend riêng).
- Trong app có ô nhập: `apiBase`, `origin`, `token` (lưu local theo máy).
- Auto refetch: 20 giây/lần.
