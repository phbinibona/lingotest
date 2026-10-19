import json,re,pathlib

root=pathlib.Path(__file__).resolve().parent.parent
D={}
def add(lang,id,title,author,character,scene,context,tip,source,text):
 D.setdefault(lang,[]).append(dict(id=id,title=title+' · '+character,poet=author,character=character,scene=scene,tag=scene,colour=['#d0befb','#f6c6d8'][len(D.get(lang,[]))%2],extent={'en':'Dramatic extract','fr':'Extrait théâtral','ca':'Fragment teatral','de':'Theaterauszug','es':'Fragmento teatral'}[lang],tip=context+' '+tip,source=source,lines=text.split('\n')))
add('en','jaques','As You Like It','William Shakespeare (1564–1616)','Jaques','Act II, scene VII','Jaques describes life as a play, with each person taking different roles.','Address an imagined listener. Let the images change your pace; you need not pause at every line.','https://www.gutenberg.org/ebooks/1523',"""All the world’s a stage,
And all the men and women merely players;
They have their exits and their entrances;
And one man in his time plays many parts,
His acts being seven ages. At first the infant,
Mewling and puking in the nurse’s arms.
And then the whining school-boy, with his satchel
And shining morning face, creeping like snail
Unwillingly to school.""")
add('en','prospero','The Tempest','William Shakespeare (1564–1616)','Prospero','Act IV, scene I','A magical performance has ended. Prospero reassures Ferdinand, then reflects on how everything passes.','Try a quiet, thoughtful voice. Let “dreams” and the final image reach your listener.','https://www.gutenberg.org/ebooks/23042',"""Our revels now are ended. These our actors,
As I foretold you, were all spirits and
Are melted into air, into thin air:
And, like the baseless fabric of this vision,
The cloud-capp’d towers, the gorgeous palaces,
The solemn temples, the great globe itself,
Yea, all which it inherit, shall dissolve
And, like this insubstantial pageant faded,
Leave not a rack behind. We are such stuff
As dreams are made on, and our little life
Is rounded with a sleep.""")
add('fr','harpagon','L’Avare','Molière (1622–1673)','Harpagon','Acte IV, scène VII','Harpagon découvre que son argent a disparu. Il cherche un voleur partout.','Fais entendre ses changements de pensée. La panique peut être comique sans crier. Fragment en prose : les lignes suivent les phrases.','https://fr.wikisource.org/wiki/L’Avare_(Molière)/Édition_Louandre,_1910/Acte_IV',"""Au voleur ! au voleur ! à l’assassin ! au meurtrier ! Justice, juste ciel !
Je suis perdu, je suis assassiné ; on m’a coupé la gorge : on m’a dérobé mon argent.
Qui peut-ce être ? Qu’est-il devenu ? Où est-il ? Où se cache-t-il ?
Que ferai-je pour le trouver ? Où courir ? Où ne pas courir ?
N’est-il point là ? n’est-il point ici ? Qui est-ce ? Arrête.""")
add('fr','don-diegue','Le Cid','Pierre Corneille (1606–1684)','Don Diègue','Acte I, scène IV','Après une gifle, Don Diègue se sent humilié et trop âgé pour défendre son honneur.','Fais sentir le contraste entre sa gloire passée et son impuissance présente. Une voix retenue peut être forte.','https://fr.wikisource.org/wiki/Le_Cid/Édition_Ginn/Acte_I',"""Ô rage ! ô désespoir ! ô vieillesse ennemie !
N’ai-je donc tant vécu que pour cette infamie ?
Et ne suis-je blanchi dans les travaux guerriers
Que pour voir en un jour flétrir tant de lauriers ?
Mon bras, qu’avec respect toute l’Espagne admire,
Mon bras, qui tant de fois a sauvé cet empire,
Tant de fois affermi le trône de son roi,
Trahit donc ma querelle, et ne fait rien pour moi ?""")
add('de','faust','Faust I','Johann Wolfgang von Goethe (1749–1832)','Faust','Nacht','Faust sitzt in seinem Studierzimmer. Trotz seiner Studien findet er keine befriedigenden Antworten.','Sprich wie jemand, der wirklich nachdenkt. Zeige den Wechsel von der langen Liste zur Enttäuschung. Historische Schreibweise bleibt erhalten.','https://de.wikisource.org/wiki/Faust_-_Der_Tragödie_erster_Teil',"""Habe nun, ach! Philosophie,
Juristerey und Medicin,
Und leider auch Theologie!
Durchaus studirt, mit heißem Bemühn.
Da steh’ ich nun, ich armer Thor!
Und bin so klug als wie zuvor;""")
add('de','tell','Wilhelm Tell','Friedrich Schiller (1759–1805)','Tell','IV. Aufzug, 3. Szene','Tell wartet auf den gewalttätigen Landvogt Gessler und plant einen tödlichen Schuss.','Lass Entschlossenheit und Spannung hörbar werden, ohne zu schreien. „Hohle Gasse“ bedeutet einen engen, eingeschnittenen Weg. Historische Schreibweise.','https://de.wikisource.org/wiki/Wilhelm_Tell/Vierter_Aufzug',"""Durch diese hohle Gasse muß er kommen,
Es führt kein andrer Weg nach Küßnacht – Hier
Vollend ichs – Die Gelegenheit ist günstig.
Dort der Hollunderstrauch verbirgt mich ihm,
Von dort herab kann ihn mein Pfeil erlangen,
Des Weges Enge wehret den Verfolgern.
Mach deine Rechnung mit dem Himmel Vogt,
Fort mußt du, deine Uhr ist abgelaufen.""")
add('ca','marta-reprotxe','Terra baixa','Àngel Guimerà (1845–1924)','Marta','Acte III, escena VI · El retret','Els veïns diuen que només han obeït l’amo. Marta els retreu el mal que han fet a en Manelic.','Parla a persones que tens al davant. Dona un sentit diferent a les dues preguntes finals. Ortografia de l’edició de 1897; pauses en prosa, no versos.','https://ca.wikisource.org/wiki/Terra_baixa_-_Acte_Tercer',"""Infelissos!...
Per obediencia m’heu tingut sempre malicia, á mí que may us havía fet cap mal á vosaltres!
Y per obediencia us heu rigut del Manelich, y l’heu martiritzat!
Qué us havía fet ell perque’l maltractessiu aixís?
Qué us havía fet?""")
add('ca','marta-muntanya','Terra baixa','Àngel Guimerà (1845–1924)','Marta','Acte III, escena VI · Muntanyes amunt','Marta vol marxar amb en Manelic, lluny de la gent que se’n riu.','Fes créixer la idea de pujar i fugir. Respira entre grups de sentit. Ortografia de 1897; el fragment acaba dins d’una intervenció més llarga.','https://ca.wikisource.org/wiki/Terra_baixa_-_Acte_Tercer',"""Y are per qué priveu de que’l cridi la Nuri?
Qué se us endona á vosaltres?...
Si lo que vull jo es anármen ab ell, ab el meu marit,
amunt, sempre montanyas amunt,
fins allá ahont no trobém gent que s’enriga de nosaltres!""")
add('es','segismundo','La vida es sueño','Pedro Calderón de la Barca (1600–1681)','Segismundo','Jornada II · ¿Qué es la vida?','Segismundo duda de lo que ha vivido y se pregunta qué diferencia hay entre la vida y un sueño.','Haz que las preguntas parezcan nuevas. Deja un pequeño silencio antes de la conclusión.','https://www.cervantesvirtual.com/obra-visor/la-vida-es-sueno--0/html/fedc73fa-82b1-11df-acc7-002185ce6064_3.html',"""Yo sueño que estoy aquí
 destas prisiones cargado,
y soñé que en otro estado
más lisonjero me vi.
¿Qué es la vida? Un frenesí.
¿Qué es la vida? Una ilusión,
una sombra, una ficción,
y el mayor bien es pequeño;
que toda la vida es sueño,
y los sueños, sueños son.""")
add('es','segismundo-rey','La vida es sueño','Pedro Calderón de la Barca (1600–1681)','Segismundo','Jornada II · Sueña el rey','Segismundo imagina que incluso el poder de un rey puede desaparecer como un sueño.','Empieza como si contaras una historia. Deja que la pregunta final cambie el tono.','https://www.cervantesvirtual.com/obra-visor/la-vida-es-sueno--0/html/fedc73fa-82b1-11df-acc7-002185ce6064_3.html',"""Sueña el rey que es rey, y vive
con este engaño mandando,
disponiendo y gobernando;
y este aplauso, que recibe
prestado, en el viento escribe,
y en cenizas le convierte
la muerte, ¡desdicha fuerte!;
¿que hay quien intente reinar,
viendo que ha de despertar
en el sueño de la muerte?""")
# Keep originals intact; derive drama editions from the established independent workflow.
engines={'en':'versestage.js','fr':'wizpoem-fr.js','ca':'wizpoem-ca.js','de':'versestage-de.js','es':'wizpoem-es.js'}
words={'en':[(r'\bpoems\b','texts'),(r'\bpoem\b','text'),(r'\bPoems\b','Texts'),(r'\bPoem\b','Text'),(r'\bpoet\b','author')], 'fr':[(r'poèmes','textes'),(r'poème','texte'),(r'Poèmes','Textes'),(r'Poème','Texte'),(r'\bvers\b','lignes')], 'ca':[(r'poemes','textos'),(r'poema','text'),(r'Poemes','Textos'),(r'Poema','Text'),(r'versos','línies')], 'de':[(r'Gedichte','Texte'),(r'Gedicht','Text'),(r'Verse','Zeilen')], 'es':[(r'poemas','textos'),(r'poema','texto'),(r'Poemas','Textos'),(r'Poema','Texto'),(r'versos','líneas')]}
copy={'en':['Drama · Your voice. Your choice.','Step into a character’s shoes.','Choose a short speech. Discover who is speaking and why, record it, listen and get personal feedback. Practise independently, at your own pace.','Choose a dramatic text','2 dramatic extracts','Original public-domain texts. Read the character and scene notes before you begin. These are extracts, not complete speeches.'], 'fr':['Théâtre · Ta voix. Ton choix.','Entre dans la peau d’un personnage.','Choisis une courte tirade. Découvre qui parle et pourquoi, enregistre-toi, écoute et reçois des conseils personnels. Tu avances en autonomie.','Choisis un texte théâtral','2 extraits théâtraux','Textes originaux du domaine public. Lis les indications sur le personnage et la scène. Ce sont des extraits, pas des tirades complètes.'], 'ca':['Teatre · La teva veu. La teva tria.','Posa’t a la pell d’un personatge.','Tria un parlament breu. Descobreix qui parla i per què, grava’t, escolta i rep consells personals. Practica de manera autònoma.','Tria un text teatral','2 fragments teatrals','Textos originals de domini públic. Llegeix les notes del personatge i de l’escena. Són fragments, no parlaments complets.'], 'de':['Theater · Deine Stimme. Deine Wahl.','Schlüpfe in eine Rolle.','Wähle eine kurze Rede. Entdecke, wer spricht und warum, nimm dich auf, höre zu und erhalte persönliche Tipps. Du übst selbstständig.','Wähle einen Theatertext','2 Theaterauszüge','Originaltexte aus gemeinfreien Werken. Lies die Hinweise zu Figur und Szene. Du liest Auszüge, keine vollständigen Reden.'], 'es':['Teatro · Tu voz. Tu elección.','Ponte en la piel de un personaje.','Elige un parlamento breve. Descubre quién habla y por qué, grábate, escucha y recibe consejos personales. Practica de forma autónoma.','Elige un texto teatral','2 fragmentos teatrales','Textos originales de dominio público. Lee las notas sobre el personaje y la escena. Son fragmentos, no parlamentos completos.']}
for lang,engine in engines.items():
 suffix='' if lang=='en' else '-'+lang
 js=(root/engine).read_text(); start=js.index("const views=")
 prefix="'use strict';\n(()=>{\nconst $=id=>document.getElementById(id);\nconst activePoemSet='drama';\nconst poems="+json.dumps(D[lang],ensure_ascii=False)+";\n"
 js=js[start:]
 js=re.sub(r"\$\('poemSet'\)\.value=activePoemSet;.*?(?=\$\('poemSearch'\)\.oninput)",'',js,flags=re.S)
 # Replace only string literals, preserving variable names and API contract keys.
 def convert(m):
  s=m.group(0)
  if re.fullmatch(r"['\"][A-Za-z0-9_-]+['\"]",s):return s
  for a,b in words[lang]:s=re.sub(a,b,s)
  return s
 js=re.sub(r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"",convert,js)
 # Preserve backend poet field; add a bounded genre marker for drama coaching.
 js=js.replace('privatePractice:true','privatePractice:true,genre:"drama"')
 js=js.replace("poet:readingAtCapture.author","poet:readingAtCapture.poet")
 # Literal replacement above must never affect property access (only literals).
 (root/('wizdrama'+suffix+'.js')).write_text(prefix+js)
 html=(root/('WizPoem'+suffix+'.html')).read_text()
 # Translate text nodes only, keeping element IDs, styles and script paths intact.
 def textnode(m):
  t=m.group(1)
  for a,b in words[lang]:t=re.sub(a,b,t)
  return '>'+t+'<'
 parts=re.split(r'(<style\b[^>]*>.*?</style>|<script\b[^>]*>.*?</script>)',html,flags=re.S)
 html=''.join(part if part.startswith(('<style','<script')) else re.sub(r'>([^<>]+)<',textnode,part) for part in parts)
 c=copy[lang]
 html=re.sub(r'<title>.*?</title>','<title>WizPoem · '+c[3]+'</title>',html)
 html=re.sub(r'(<div class="hero"><div><div class="eyebrow">).*?(</div><div class="hero-stamp")',lambda m:m[1]+c[0]+'</div><h1>'+c[1]+'</h1><p>'+c[2]+'</p>'+m[2],html,flags=re.S)
 html=re.sub(r'(<button[^>]*id="tab-choose"[^>]*>).*?(</button>)',lambda m:m[1]+'01 · '+c[3]+m[2],html)
 html=re.sub(r'(<section id="choose".*?<h2>).*?(</h2>)',lambda m:m[1]+c[3]+m[2],html,flags=re.S)
 html=re.sub(r'(<span[^>]*id="collectionCount"[^>]*>).*?(</span>)',lambda m:m[1]+c[4]+m[2],html)
 html=re.sub(r'(<section id="choose".*?<p class="muted">).*?(</p>)',lambda m:m[1]+c[5]+m[2],html,flags=re.S)
 html=re.sub(r'<div class="poem-collection">.*?</div>','',html,flags=re.S)
 html=html.replace('/'+engine+'?v=20261019solo','/wizdrama'+suffix+'.js?v=20261019drama')
 (root/('WizDrama'+suffix+'.html')).write_text(html)

