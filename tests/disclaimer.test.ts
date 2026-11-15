import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import SystemInfo from '../app/system-info';
import {DISCLAIMER_SUMMARY,DISCLAIMER_SECTIONS} from '../lib/disclaimer';
test('public disclaimer, documentation and about panel share the same risk notice',()=>{
 const document=readFileSync('DISCLAIMER.md','utf8');assert.ok(document.includes(DISCLAIMER_SUMMARY));for(const section of DISCLAIMER_SECTIONS){assert.ok(document.includes(section.title));for(const paragraph of section.paragraphs)assert.ok(document.includes(paragraph));}
 const html=renderToStaticMarkup(React.createElement(SystemInfo,{active:true,account:{role:'owner',version:'1.0.24',loginId:'test'}}));assert.ok(html.includes('Miễn trừ trách nhiệm và lưu ý sử dụng'));assert.ok(html.includes('href="/disclaimer"'));assert.ok(html.includes('Không thể bảo đảm'));assert.ok(html.includes('pháp luật bắt buộc áp dụng'));
});
