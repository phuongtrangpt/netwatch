import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {renderLogin} from '../server/login-page';
import BrandFooter from '../app/brand-footer';
const facebook='https://www.facebook.com/leviethoaiphuong/';
test('login uses original brand asset, complete contact links and a logo-only upper left header',()=>{
 const html=renderLogin();assert.ok(html.includes('Hệ thống giám sát'));assert.ok(html.includes('mạng chuyên nghiệp'));
 const header=html.match(/<header class="login-header">([\s\S]*?)<\/header>/)![1];assert.equal(header.replace(/<[^>]*>/g,'').trim(),'NETWATCH');
 assert.ok(html.includes('src="/brand/logo-viet-phuong.png"'));assert.ok(html.includes(`href="${facebook}"`));assert.ok(html.includes(`>${facebook}</span>`));assert.ok(html.includes('href="tel:0963839369"'));assert.ok(html.includes('Trang được sử dụng miễn phí'));
 assert.equal(createHash('sha256').update(readFileSync('public/brand/logo-viet-phuong.png')).digest('hex'),'e01e5130e9a572428c244ce8315145cfec96717c719e637a1dd542ae729ba73b');
});
test('failed login remains visible and escapes the submitted username',()=>{
 const html=renderLogin(true,'"><script>alert(1)</script>');assert.ok(html.includes('Tên đăng nhập hoặc mật khẩu chưa đúng.'));assert.ok(!html.includes('role="alert" hidden'));assert.ok(html.includes('value="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'));assert.ok(!html.includes('<script>alert(1)</script>'));
});
test('dashboard footer displays phone, full Facebook URL, copyright and free-use notice',()=>{
 const html=renderToStaticMarkup(React.createElement(BrandFooter));assert.ok(html.includes('dashboard-footer'));assert.ok(html.includes(`href="${facebook}"`));assert.ok(html.includes('rel="noopener noreferrer"'));assert.ok(html.includes('0963 839 369'));assert.ok(html.includes('Việt Phương. Bảo lưu mọi quyền.'));assert.ok(html.includes('Trang được sử dụng miễn phí'));
});
