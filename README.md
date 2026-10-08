# งานรถทอย

เครื่องมือส่วนตัวสำหรับรายงานในกลุ่ม LINE ระหว่างกะ

- `report.html` — รายงานขึ้นของ / ลงของ และคืนรถก่อนเลิกกะ (คัดลอกข้อความไปวางใน LINE)
- `map.html` — ผังช่องจอด 2 อาคาร
- `slots.js` — แตะช่องเพื่อสลับ ว่าง / ไม่ว่าง ทุกคนเห็นตรงกัน (เก็บที่ Supabase ตาราง `jt_parking_slots`)

ไฟล์ในนี้สร้างอัตโนมัติจากโฟลเดอร์ต้นฉบับ `Desktop\noName\JT` ด้วย `_build\publish_jt.py`
อัปเดต: แก้ต้นฉบับ แล้วดับเบิลคลิก `update-site.bat`

**สำคัญ:** `slots.js` เขียนมือ ไม่ได้มาจาก `publish_jt.py` — ในต้นฉบับ `map.html` ต้องมีบรรทัด
`<script src="slots.js" defer></script>` ก่อน `</body>` และ `publish_jt.py` ต้องไม่ลบ `slots.js` ทิ้ง
