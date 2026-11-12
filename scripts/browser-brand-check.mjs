// CI browser regression checks use only a disposable local app and synthetic credentials.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
const data=mkdtempSync(join(tmpdir(),'netwatch-browser-')),base='http://127.0.0.1:18091',password='Browser-test-only-12345';
const child=spawn(process.execPath,['dist/server.mjs'],{env:{...process.env,DATA_DIR:data,PORT:'18091',NETWATCH_PASSWORD:password},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,output);
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});mkdirSync('artifacts/ui',{recursive:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/login');await page.locator('.card-logo').waitFor();await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await page.locator('.login-header').innerText(),'NETWATCH');assert.equal(await page.locator('.card-logo').evaluate(el=>el.naturalWidth),2000);assert.equal(await page.locator('.footer-facebook').getAttribute('href'),'https://www.facebook.com/leviethoaiphuong/');
 await page.screenshot({path:'artifacts/ui/login-desktop.png',fullPage:true});
 await page.locator('#toggle-password').click();assert.equal(await page.locator('#password').getAttribute('type'),'text');await page.locator('#toggle-password').click();
 await page.locator('#password').fill('wrong-password-12345');await page.locator('.login-submit').click();await page.locator('.login-error:not([hidden])').waitFor();assert.equal(await page.locator('#username').inputValue(),'admin');
 await page.locator('#password').fill(password);await page.locator('.login-submit').click();await page.waitForURL(base+'/');await page.locator('.dashboard-footer').waitFor();await page.locator('.project-card').first().waitFor();assert.equal(await page.locator('.dashboard-footer .footer-facebook').getAttribute('href'),'https://www.facebook.com/leviethoaiphuong/');
 await page.screenshot({path:'artifacts/ui/dashboard-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Cấu hình giám sát',exact:true}).click();await page.getByRole('button',{name:'Thêm tài khoản',exact:true}).click();await page.locator('#viewer-username').fill('owner_demo');await page.locator('#viewer-password').fill('View-test-only-12345');await page.locator('.viewer-project-list input').first().check();await page.screenshot({path:'artifacts/ui/viewer-permissions.png',fullPage:true});await page.getByRole('button',{name:'Lưu tài khoản',exact:true}).click();await page.locator('.viewer-account-row').filter({hasText:'owner_demo'}).waitFor();const support=page.locator('.support-settings');await support.locator('input[type=checkbox]').check();await support.locator('input:not([type=checkbox])').nth(0).fill('Gặp sự cố kỹ thuật? Liên hệ kỹ thuật viên');await support.locator('input:not([type=checkbox])').nth(1).fill('Việt Phương');await support.locator('input:not([type=checkbox])').nth(2).fill('0963839369');await support.locator('select').selectOption('top');await support.getByRole('button',{name:'Lưu banner',exact:true}).click();await page.locator('.support-banner').waitFor();
 const viewer=await browser.newPage({viewport:{width:1440,height:1000}});await viewer.goto(base+'/login');await viewer.locator('#username').fill('owner_demo');await viewer.locator('#password').fill('View-test-only-12345');await viewer.locator('.login-submit').click();await viewer.locator('.viewer-banner').waitFor();assert.equal(await viewer.locator('#project-select option').count(),1);assert.equal(await viewer.getByRole('button',{name:'Thêm tài khoản',exact:true}).count(),0);assert.equal(await viewer.getByRole('button',{name:'Đường truyền Internet',exact:true}).count(),0);await viewer.locator('.support-banner').waitFor();assert.equal(await viewer.locator('.support-banner a').getAttribute('href'),'tel:0963839369');await viewer.screenshot({path:'artifacts/ui/viewer-dashboard.png',fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});await mobile.goto(base+'/login');await mobile.waitForFunction(()=>Array.from(document.images).filter(i=>getComputedStyle(i).display!=='none').every(i=>i.complete&&i.naturalWidth>0));await mobile.screenshot({path:'artifacts/ui/login-mobile.png',fullPage:true});
 const bounds=await mobile.locator('.footer-facebook').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391,JSON.stringify(bounds));assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.deepEqual(errors,[]);
 console.log('Browser checks passed: desktop/mobile, original logo, clickable contacts, password visibility, login errors, login success, dashboard footer.');
}finally{await browser?.close();if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}rmSync(data,{recursive:true,force:true});}
