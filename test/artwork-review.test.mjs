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

test('ambiguous pulldown sequence stays withdrawn while its initial setup is labelled',()=>{
 const a=app();assert.match(a.run(`overviewGraphic('pulldown')`),/pulldown-reviewed\.png/);assert.match(a.run(`overviewGraphic('pulldown')`),/准备姿势/);assert.equal(a.run(`keyframeTeaching('pulldown')`),'');assert.equal(a.run(`keyframeTile('pulldown',1)`),'');assert.match(a.run(`keyframeTeaching('chestsupported')`),/胸部不离垫/);
});

test('single arm rowing uses its D-handle picture without changing records or other variation thumbnails',()=>{
 const a=app();const before=a.run('JSON.stringify(state)');assert.match(a.run(`overviewGraphic('cablerowSingle')`),/equipment-reviewed\.png/);assert.match(a.run(`overviewGraphic('pulldownNeutral')`),/positions-reviewed\.png/);assert.doesNotMatch(a.run(`overviewGraphic('cablerow')`),/equipment-reviewed/);assert.match(a.run(`overviewGraphic('pulldownSingle')`),/部位示意/);assert.equal(a.run('JSON.stringify(state)'),before);
});

test('reviewed illustrations are cached for offline use and new cue is translated',()=>{
 const shell=readFileSync(new URL('../sw.js',import.meta.url),'utf8');for(const file of new Set(Object.values(reviewedArtwork).map(a=>a.file)))assert(shell.includes('./assets/exercises/'+file),file);assert(!/[\u3400-\u9fff]/.test(translateText('面向器械，双手正握、拇指环握。')));
});

test('all previously illustrated movements have an audit outcome and unapproved leg curl is visibly withheld',()=>{
 const audit=JSON.parse(readFileSync(new URL('../assets/exercises/REVIEW.json',import.meta.url)));assert.equal(audit.movementIdsChecked,34);assert.equal(audit.rows.length,34);assert.equal(audit.decisions.replaced,12);assert.equal(audit.decisions.withheld,3);const a=app();assert.equal(Object.hasOwn(overviewArtwork,'legcurl'),false);assert.match(a.run(`overviewGraphic('legcurl')`),/动作图待更新/);assert.doesNotMatch(a.run(`overviewGraphic('legcurl')`),/equipment-reviewed|setups-reviewed/);for(const id of ['bench','incline']){assert.equal(Object.hasOwn(overviewArtwork,id),false);assert.match(a.run(`overviewGraphic('${id}')`),/动作图待更新/);}for(const id of ['deadbug','bird'])assert.match(a.run(`overviewGraphic('${id}')`),/准备姿势/);
});

test('non-uniform panel crops preserve proportions and full selected bounds',()=>{
 const a=app();for(const id of ['barhip','bird','dbcalf','pushup','deadlift','rdl']){const {crop:c}=reviewedArtwork[id];assert(c.x>=0&&c.y>=0&&c.x+c.width<=c.sourceWidth&&c.y+c.height<=c.sourceHeight);const html=a.run(`overviewGraphic('${id}')`);assert.match(html,/clip-path:inset/);assert.match(html,/background-size:/);}for(const cue of ['轻抬手臂，颈部放松，允许肩胛随抬臂自然运动','不强行拉向身后，避免用力缩颈，允许肩胛自然运动','姿势与幅度按器械、自身活动范围和控制能力调整，不必照图达到固定角度。'])assert.doesNotMatch(translateText(cue),/[\u3400-\u9fff]/);
});
