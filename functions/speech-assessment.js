'use strict';

// Netlify function for Azure Speech pronunciation assessment.
// Environment variables:
//   AZURE_SPEECH_KEY     one of the two Azure Speech resource keys
//   AZURE_SPEECH_REGION  for example: westeurope
// Optional:
//   AZURE_SPEECH_ENDPOINT  the resource endpoint shown in Azure

const json=(statusCode,body)=>({
  statusCode,
  headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Methods':'POST, OPTIONS'
  },
  body:JSON.stringify(body)
});

exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return json(204,{});
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});

  const key=process.env.AZURE_SPEECH_KEY||process.env.SPEECH_KEY;
  const region=process.env.AZURE_SPEECH_REGION||process.env.SPEECH_REGION;
  const configuredEndpoint=process.env.AZURE_SPEECH_ENDPOINT||process.env.SPEECH_ENDPOINT;
  if(!key||(!region&&!configuredEndpoint)){
    return json(503,{error:'Azure Speech is not configured'});
  }

  let input;
  try{input=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid JSON'})}
  const referenceText=String(input.referenceText||input.text||'').trim();
  const languageCode=String(input.languageCode||input.locale||input.language||'en-GB').trim();
  const encoded=String(input.audioBase64||input.audio||'').replace(/^data:audio\/[^;]+;base64,/, '');
  if(!referenceText||!encoded)return json(400,{error:'Audio and reference text are required'});
  if(encoded.length>8_000_000)return json(413,{error:'Recording is too large'});

  let audio;
  try{audio=Buffer.from(encoded,'base64')}catch{return json(400,{error:'Invalid audio'})}
  if(audio.length<44)return json(400,{error:'Recording is empty'});

  const assessment={
    ReferenceText:referenceText,
    GradingSystem:'HundredMark',
    Granularity:'Word',
    Dimension:'Comprehensive',
    EnableMiscue:'True',
    EnableProsodyAssessment:'True'
  };
  const pronunciationHeader=Buffer.from(JSON.stringify(assessment),'utf8').toString('base64');
  const base=(configuredEndpoint
    ? configuredEndpoint.replace(/\/$/,'')
    : `https://${region}.stt.speech.microsoft.com`
  ).replace(/\/stt\/speech\/recognition\/conversation\/cognitiveservices\/v1.*$/,'');
  const url=`${base}/stt/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(languageCode)}&format=detailed&profanity=raw`;

  try{
    const response=await fetch(url,{
      method:'POST',
      headers:{
        'Ocp-Apim-Subscription-Key':key,
        'Pronunciation-Assessment':pronunciationHeader,
        'Content-Type':'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Accept':'application/json'
      },
      body:audio
    });
    const raw=await response.text();
    let data;try{data=JSON.parse(raw)}catch{data={error:raw||'Azure returned an invalid response'}}
    if(!response.ok)return json(response.status,{error:data.error?.message||data.error||`Azure Speech returned ${response.status}`});
    const best=data.NBest&&data.NBest[0];
    if(data.RecognitionStatus!=='Success'||!best){
      return json(422,{error:data.RecognitionStatus||'No speech was recognised'});
    }
    const weakest=(best.Words||[])
      .filter(word=>Number.isFinite(Number(word.AccuracyScore)))
      .sort((a,b)=>Number(a.AccuracyScore)-Number(b.AccuracyScore))
      .slice(0,3)
      .map(word=>({word:word.Word,accuracyScore:word.AccuracyScore,errorType:word.ErrorType}));
    return json(200,{
      accuracyScore:best.AccuracyScore,
      fluencyScore:best.FluencyScore,
      completenessScore:best.CompletenessScore,
      pronunciationScore:best.PronScore,
      prosodyScore:best.ProsodyScore,
      recognisedText:best.Display||data.DisplayText||'',
      weakestWords:weakest,
      rawStatus:data.RecognitionStatus
    });
  }catch(error){
    console.error('Azure pronunciation assessment failed',error);
    return json(502,{error:'The speech service could not be reached'});
  }
};
