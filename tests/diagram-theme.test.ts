import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagramAppearance,validBackground,DEFAULT_DIAGRAM_BACKGROUND} from '../lib/diagram-theme';
test('diagram background preferences accept hex colors and safely replace invalid stored values',()=>{assert.equal(validBackground('#000000'),true);assert.equal(validBackground('#fAcC15'),true);for(const value of [null,{},'red','#fff','url(test)','#123456; color:red']){assert.equal(validBackground(value),false);assert.equal(diagramAppearance(value).background,DEFAULT_DIAGRAM_BACKGROUND);}});
test('dark/light canvases keep yellow links and choose readable contrasting overlays',()=>{const dark=diagramAppearance('#000000'),light=diagramAppearance('#ffffff');assert.equal(dark.dark,true);assert.equal(light.dark,false);assert.equal(dark.online,'#facc15');assert.equal(light.online,'#facc15');assert.notEqual(dark.unknown,light.unknown);assert.notEqual(dark.labelText,light.labelText);});
