import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {app} from '../test-support/helper.mjs';
import {overviewArtwork,reviewedArtwork} from '../modules/daily-overview.js';
import {translateText} from '../modules/localization.js';

test('reviewed art is assigned only to exact catalog IDs with valid individual frame coordinates',()=>{
 const a=app();for(const [id,art]of Object.entries(reviewedArtwork)){assert(a.run(`!!catalog[${JSON.stringify(id)}]`),id);assert(Object.hasOwn(overviewArtwork,id));assert(art.column>=0&&art.column<art.columns);assert(art.row>=0&&art.row<art.rows);assert(existsSync(new URL('../assets/exercises/'+art.file,import.meta.url)));}
 for(const id of ['pulldownWide','pulldownSingle','cablerowWide'])assert.equal(Object.hasOwn(reviewedArtwork,id),false,id);
});

test('all pulldown positions and thumbnails bypass the retired machine-facing image',()=>{
 const a=app();assert.match(a.run(`overviewGraphic('pulldown')`),/pulldown-reviewed\.png/);assert.match(a.run(`keyframeTile('pulldown',0)`),/teaching-frame-pulldown-reviewed/);assert.match(a.run(`keyframeTile('pulldown',1)`),/background-position:100% 0%/);assert.match(a.run(`keyframeTeaching('pulldown')`),/面向器械/);assert.doesNotMatch(a.run(`keyframeTile('chestsupported',0)`),/pulldown-reviewed/);
});

test('single arm rowing uses its D-handle picture without changing records or other variation thumbnails',()=>{
 const a=app();const before=a.run('JSON.stringify(state)');assert.match(a.run(`overviewGraphic('cablerowSingle')`),/equipment-reviewed\.png/);assert.match(a.run(`overviewGraphic('pulldownNeutral')`),/positions-reviewed\.png/);assert.doesNotMatch(a.run(`overviewGraphic('cablerow')`),/equipment-reviewed/);assert.match(a.run(`overviewGraphic('pulldownSingle')`),/部位示意/);assert.equal(a.run('JSON.stringify(state)'),before);
});

test('reviewed illustrations are cached for offline use and new cue is translated',()=>{
 const shell=readFileSync(new URL('../sw.js',import.meta.url),'utf8');for(const file of new Set(Object.values(reviewedArtwork).map(a=>a.file)))assert(shell.includes('./assets/exercises/'+file),file);assert(!/[\u3400-\u9fff]/.test(translateText('面向器械，大腿固定，双臂向上伸展。')));
});

test('all previously illustrated movements have an audit outcome and unapproved leg curl is visibly withheld',()=>{
 const audit=JSON.parse(readFileSync(new URL('../assets/exercises/REVIEW.json',import.meta.url)));assert.equal(audit.movementIdsChecked,34);assert.equal(audit.rows.length,34);assert.equal(audit.decisions.replaced,8);assert.equal(audit.decisions.withheld,1);const a=app();assert.equal(Object.hasOwn(overviewArtwork,'legcurl'),false);assert.match(a.run(`overviewGraphic('legcurl')`),/动作图待更新/);assert.doesNotMatch(a.run(`overviewGraphic('legcurl')`),/equipment-reviewed|setups-reviewed/);for(const id of ['deadbug','bird'])assert.match(a.run(`overviewGraphic('${id}')`),/准备姿势/);
});
