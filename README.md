# Yida Products Monitor (Web Only)

Project hiện dùng theo mô hình:
- `backend/` → API proxy/aggregate cho Yida
- `frontend/` → giao diện web React/Vite

Không còn dùng app desktop/EXE trong flow chính nữa.

---

## 1) Chạy backend

```bash
cd backend
cp .env.example .env
# sửa PRODUCT_TOKEN / INTERNAL_API_KEY / ALLOWED_ORIGINS nếu cần
npm i
npm start
```

Backend mặc định chạy ở:
- `http://localhost:8787`

Endpoint chính:
- `GET /api/running-products`

### Headers hỗ trợ
- `x-product-token` → dùng khi không set `PRODUCT_TOKEN` ở backend
- `x-internal-key` → dùng khi backend có set `INTERNAL_API_KEY`

---

## 2) Chạy frontend

```bash
cd frontend
npm i
npm run dev -- --host 0.0.0.0
```

Frontend mặc định chạy ở:
- `http://localhost:5173`

---

## 3) Chạy từ root project

```bash
# chạy backend
npm run backend:start

# chạy frontend dev
npm run frontend:dev

# build frontend
npm run frontend:build

# preview frontend production build
npm run frontend:preview
```

---

## 4) Build frontend

```bash
cd frontend
npm run build
```

Output nằm ở:
- `frontend/dist/`

---

## 5) Mapping icon mức đơn

- `>=10 đơn`: `frontend/public/hot-icon.mp4`
- `3–9 đơn`: `frontend/public/warm-icon.mp4`
- `<3 đơn`: `frontend/public/idle-icon.mp4`

Fallback emoji khi media lỗi:
- `>=10` -> 🔥
- `3–9` -> 🟢
- `<3` -> ⚪

---

## 6) Ghi chú

- Frontend đã chuyển sang gọi backend bằng header, không dùng `?token=` nữa.
- Nếu backend bật `INTERNAL_API_KEY`, frontend phải nhập thêm `Internal Key`.
- Các file/folder desktop cũ có thể được archive hoặc xóa sau nếu chắc chắn không cần giữ nữa.
