# CodeDetector

แอปมือถือภาษาไทยสำหรับถ่ายภาพอ่าน MFG / EXP / รหัสเครื่องจักร ตรวจเทียบ Standard และสร้างรายงานภาพแชร์ LINE

## ใช้งาน

1. เปิดเว็บ HTTPS จากมือถือ ไม่ต้องติดตั้งหรือเข้าสู่ ChatGPT สำหรับการตรวจทั่วไป
2. ผู้ดูแลเข้า มาตรฐาน → สำหรับผู้ดูแล และลงชื่อเข้า ChatGPT ด้วยบัญชีที่ได้รับอนุญาต เพิ่ม Standard จริงครั้งแรก
3. ถ่าย/อัปโหลดภาพแล้วกดตรวจ ระบบจับคู่ SKU/บาร์โค้ด/ชื่อสินค้าตามค่าที่กำหนดไว้ ถ้าไม่พบให้เลือกสินค้า
4. รายงานบันทึกใน IndexedDB อัตโนมัติ ดูย้อนหลัง ดาวน์โหลด PNG หรือแชร์ได้

ผู้ใช้ไม่ต้องกรอกข้อมูลเทียบทุกครั้ง แต่ระบบต้องมี Standard ที่ถูกต้องก่อน จึงจะรับรองว่าผ่านได้

## เริ่มพัฒนา

ต้องมี Node 22.13 ขึ้นไป (ตรวจด้วย Node 24 บน Windows)

- npm ci
- สร้าง .env.local ตามชื่อค่าตัวอย่างใน .env.example เก็บคีย์เฉพาะไฟล์ ignored นี้
- npm run build
- Apply migration เฉพาะฐานข้อมูล local:
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_awesome_the_phantom.sql
- npm run dev แล้วเปิด URL loopback ที่คำสั่งแสดง
- Local preview login จำลอง seedy@sites.test เฉพาะ development; production ใช้ Sites ChatGPT sign-in จริง

npm run typecheck ตรวจ TypeScript · npm test ทดสอบกฎ · npm run build สร้าง Worker

## Standard และผลตรวจ

- วันที่ 9 รูปแบบ ภาษาเดือนอังกฤษ/ไทย ตัวเลขไทย พ.ศ./ค.ศ. ฐานปีสองหลัก 2000/2500 ตามปฏิทินที่ผู้ดูแลระบุ
- EXP = MFG + จำนวนวันหรือเดือน แบบเดือนใช้วันสุดท้ายของเดือนเมื่อไม่มีวันเดิม
- เทียบวันตรวจตาม Asia/Bangkok; วัน EXP ยังถือว่าไม่หมดอายุ
- ข้อผิดที่ยืนยันได้ → ไม่ผ่าน; ไม่มีข้อผิดแน่นอนแต่ข้อมูลจำเป็นไม่ครบ → ต้องตรวจซ้ำ; ครบและผ่านทุกกฎ → ผ่าน
- ไม่แปลง O เป็น 0 ไม่เดาวันที่ขาด ไม่ใช้อายุสินค้าที่ AI คำนวณจากภาพเป็น Standard ของภาพเดียวกัน
- จับคู่ SKU/บาร์โค้ดตรงกันก่อนชื่อสินค้า หากหลาย Standard ตรงกันต้องเลือก ไม่จับคู่แบบคล้ายแล้วผ่านทันที
- ใช้สินค้าที่จำไว้เฉพาะเมื่อภาพไม่มีตัวระบุสินค้า หากมี SKU/ชื่ออื่นที่ไม่ตรงจะไม่ใช้ Standard เก่า
- รายงานเก็บสำเนา Standard และผลอ่านเดิม การแก้ข้อความสร้าง ID ใหม่ โดยเก็บฉบับก่อนหน้า

## ที่เก็บข้อมูล

| ข้อมูล | ที่เก็บ |
| --- | --- |
| ตั้งค่า / สินค้าล่าสุด / cache Standard | localStorage |
| ภาพและรายงาน / ประวัติแก้ข้อความ | IndexedDB บนอุปกรณ์ |
| Standard ที่เผยแพร่ / ตัวนับโควตา / metadata แชร์ | D1 |
| ภาพรายงานที่แชร์ผ่าน LIFF และภาพตัวอย่าง | R2 |

รายงานไม่ซิงก์ระหว่างเครื่อง/เบราว์เซอร์ LINE in-app browser กับ Safari/Chrome อาจใช้พื้นที่เก็บแยกกัน ส่งออกข้อมูลจากหน้าตั้งค่าก่อนล้างข้อมูลเว็บ

ภาพต้นทางแชร์เปิดได้ 7 วันแล้วตอบ 410/404 ไม่ใช้ CDN cache งานรายชั่วโมงลบไฟล์หมดอายุ สำเนาที่ LINE หรือผู้รับเก็บไว้อาจยังอยู่

## LINE LIFF — เจ้าของตั้งครั้งเดียว

1. เข้า [LINE Developers Console](https://developers.line.biz/console/) สร้าง Provider และ LINE Login channel ชนิด Web app
2. เพิ่ม LIFF app ขนาด Full ใช้ Endpoint URL เป็น URL production ของ CodeDetector
3. เปิด scope ที่จำเป็นสำหรับ LIFF login และเปิด shareTargetPicker เจ้าของบัญชียอมรับข้อตกลงเอง
4. เปลี่ยน channel เป็น Published เพื่อให้คนนอกบทบาท developer/tester ใช้ได้
5. เก็บ LIFF ID ใน production environment LINE_LIFF_ID แล้ว deploy อีกครั้ง ไม่ต้องใช้ Channel secret ใน browser
6. เปิด LIFF URL บนมือถือ ทดสอบ login → เลือกผู้รับ → ภาพและข้อความมาถึง LINE จริง
7. หาก LIFF ยังไม่พร้อม มีปุ่มแชร์ไฟล์/ดาวน์โหลด ทางนี้ไม่อัปโหลด R2

การยกเลิกแชร์ไม่แสดงว่าส่งสำเร็จ หลังกลับจาก LINE login ให้กดแชร์รายงานเดิมอีกครั้ง
[เอกสาร LIFF](https://developers.line.biz/en/docs/liff/developing-liff-apps/)

## API และคีย์

GET /api/config, GET /api/standards เป็น public; POST /api/standards ต้องผ่าน Sites identity และ email ใน ADMIN_EMAILS
POST /api/analyze ใช้ Responses API Structured Outputs และ store:false; กฎตรวจแยกจาก AI
POST /api/shares รับรายงานและภาพตัวอย่าง; GET /share/:token ให้ LINE อ่านภาพ
POST /api/maintenance ใช้ bearer สำหรับระบบ; POST /mcp ให้เครื่องมือ cleanup เฉพาะผู้ดูแล

คีย์อยู่ server environment ไม่รวมใน client bundle, git หรือรายงาน ตั้ง production env ผ่าน Sites tools แล้ว deploy เพื่อใช้ revision ใหม่
โควตาเริ่มต้น 200 scans/day และ 200 shares/day ทั้งระบบ, 5 requests/minute ต่อ IP ต่อประเภท ปรับผ่าน environment ได้ วันโควตานับ UTC; เวลาในรายงานใช้ประเทศไทย
นับความพยายามแม้ upstream ล้มเหลว เพื่อกันเรียกซ้ำไม่จำกัด ผู้ใช้ไม่ต้องมี API key ส่วนตัว
store:false ไม่ใช่การรับรอง zero data retention ของผู้ให้บริการ

## OpenAI quota

ทดสอบ API จริงวันที่ 1 พฤศจิกายน 2026 ตอบ HTTP 429, credit_balance_exhausted / insufficient_quota: ต้องเติมเครดิตก่อนอ่านภาพจริง
[API Billing](https://platform.openai.com/settings/organization/billing/) แยกจากสมาชิก ChatGPT
คีย์ CodexAICode ตั้งอายุ 7 วัน ต้องเปลี่ยนเมื่อหมดอายุ ไม่เปลี่ยนคีย์อัตโนมัติ
งานทดลองง่ายอาจพิจารณา gpt-6-luna ภายหลัง แต่เปลี่ยนโมเดลไม่แก้เครดิตหมด และยังไม่ได้ทดสอบโมเดลนั้นในแอปนี้

## การตรวจรับ

ดู VALIDATION.md แยกการทดสอบกฎ/จำลองบริการเพื่อทดสอบ UI ออกจาก OpenAI และ LINE จริง
TEST PRODUCT และภาพสังเคราะห์ใช้เฉพาะ local/QA ไม่ seed เข้า production
