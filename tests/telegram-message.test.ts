import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectTelegramMessage as format} from '../lib/telegram-message';
test('every alert format carries the project name without repeating headers',()=>{
 for(const text of ['NetWatch · main\n🔴 FPT: mất kết nối','🔁 NetWatch · Nhà trọ\nNhắc lại mỗi 30 phút','🔴 NetWatch · main\nRouter không gửi dữ liệu','🟢 NetWatch · main\nRouter phục hồi','🔴 Camera: Offline']){
  const value=format('Trường Tam Thanh',text);assert.ok(value.includes('NetWatch · Dự án: Trường Tam Thanh'));assert.ok(value.includes(text.split('\n').at(-1)!));assert.equal(format('Trường Tam Thanh',value),value);
 }
 assert.ok(format('Dự án mới',format('Tên cũ','NetWatch · main\nFPT: Offline')).includes('Dự án: Dự án mới'));
});
