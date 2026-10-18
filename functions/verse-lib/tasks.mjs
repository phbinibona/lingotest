export function readingKey(c,poem){if(!poem)return '';return c.hash(poem.title.toLowerCase()+'|'+poem.poet.toLowerCase()+'|'+poem.lines.join('\n').replace(/\s+/g,' ').toLowerCase());}
export function cleanReading(c,poem){
  if(!poem||!Array.isArray(poem.lines)||poem.lines.length<1||poem.lines.length>60||poem.lines.some(x=>typeof x!=='string'||!x.trim())||poem.lines.join('\n').length>4000||!c.text(poem.title,140)||!c.text(poem.poet,100))throw c.fail(400,'Choose a title, author and between 1 and 60 lines (maximum 4,000 characters).');
  return {title:c.text(poem.title,140),poet:c.text(poem.poet,100),lines:poem.lines.map(x=>x.trim()),intention:c.text(poem.intention,100)};
}
export function readingFor(group,player){return player?.assignment||group.poem||null;}
export function resetTaskScores(player){for(const k of ['first','best','clarity','rhythm','expression','accuracy','poem','teacherAdjusted'])delete player[k];player.attempts=0;}
