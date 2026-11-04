const AVATARS=["🐱","🦝","🐶","🦁","🐯","🦨","🤡","🐍","🐉","🐲"];
const NAMES=["Котик","Енот","Собачка","Лев","Тигр","Скунс","Клоун","Змея","Красный дракон","Оранжевый дракон"];
const $=s=>document.querySelector(s);
const STORE_KEY="qqcross_profile_v2";
const THEME_KEY="qqcross_theme_v1";
const THEME_PRESETS={purple:"Спокойный фиолетовый",burgundy:"Спокойный бордо",black:"Спокойный чёрный"};
let activeTheme=(()=>{try{const saved=localStorage.getItem(THEME_KEY);return THEME_PRESETS[saved]?saved:"purple"}catch{return "purple"}})();
function applyTheme(theme=activeTheme){
  activeTheme=THEME_PRESETS[theme]?theme:"purple";
  document.documentElement.dataset.qqTheme=activeTheme;
  try{localStorage.setItem(THEME_KEY,activeTheme)}catch{}
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",activeTheme==="burgundy"?"#211419":activeTheme==="black"?"#111111":"#211a2c");
}
const SUPABASE_URL="https://lzpkronttfzbubbfggsb.supabase.co";
const SUPABASE_KEY="sb_publishable_2PD3wYGG1aYoxRqhyM8wMA_OIQrwm3k";
const supabaseClient=window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY):null;
let authMode="signup";
const state={profile:null,tab:"Главная",screen:"",selectedAvatar:0,selectedLetter:-1,selectedCell:null,selectedWord:"w1",letters:[],scores:0,turn:0,seconds:60,interval:null,filled:{},wrong:null,feedback:{},hints:{},loupeActive:false,completed:new Set(),partySize:2,inviteName:"",invite:null};
let puzzle=null;
const expected={};
let letterBag=[];
let draggingLetter=false;
let suppressCellClick=false;
const WORD_POOL = [
  ["ПУТЕШЕСТВИЕ","Поездка в далёкие или новые места","🧳"],["ПРИКЛЮЧЕНИЕ","Необычное и захватывающее событие","🗺️"],
  ["ЯД","Опасное вещество, способное вызвать отравление","☠️"],["УС","Волосы над верхней губой","🥸"],["ОС","Короткое название насекомого","🐝"],["УХ","Междометие удивления или часть головы","👂"],["ОН","Местоимение мужского рода","👤"],
  ["СОЛНЦЕ","Звезда, вокруг которой вращается Земля","☀️"],["КОМПАС","Прибор для определения сторон света","🧭"],["ПИРАТЫ","Морские разбойники","🏴‍☠️"],["БИБЛИЯ","Священная книга христиан","📖"],["КАРМАН","Отделение в одежде для мелочей","👖"],["РАКЕТА","Летательный аппарат для космоса","🚀"],["ВОКЗАЛ","Место отправления поездов","🚉"],["КОЛЕСО","Круглая деталь для движения транспорта","🛞"],["МОЛОКО","Белый напиток, который дают коровы","🥛"],["ЗЕРКАЛО","Предмет, в котором видно отражение","🪞"],["СОБАКА","Домашнее животное, которое часто охраняет дом","🐕"],["БАБОЧКА","Насекомое с большими разноцветными крыльями","🦋"],["ПОДУШКА","Мягкая вещь, на которой спят","🛏️"],["КОРОНА","Украшение на голове монарха","👑"],["КЛАВИШИ","Кнопки на пианино или клавиатуре","🎹"],["МЕДАЛЬ","Награда за победу или заслуги","🏅"],["ФОНАРЬ","Источник света, который берут на прогулку","🔦"],["ЛЕСТНИЦА","Сооружение для подъёма между этажами","🪜"],["ТЕЛЕФОН","Устройство для звонков и сообщений","📱"],["МУЗЫКА","Искусство звуков и мелодий","🎵"],
  ["АВТОБУС","Большой городской транспорт","🚌"],["БАРАБАН","Музыкальный инструмент, по которому ударяют","🥁"],["БРИЛЛИАНТ","Очень твёрдый драгоценный камень","💎"],["ВЕРТОЛЁТ","Летательный аппарат с винтом сверху","🚁"],["ДИНОЗАВР","Древнее животное, жившее миллионы лет назад","🦖"],["КАЛЕНДАРЬ","Таблица дней, недель и месяцев","🗓️"],["МАГНИТОФОН","Устройство для записи и воспроизведения звука","📼"],["ПАРАШЮТ","Купол, который замедляет падение","🪂"],["ПЕРЧАТКА","Одежда для защиты кисти руки","🧤"],["ПОЛОТЕНЦЕ","Ткань, которой вытираются после воды","🧺"],["ПРОГРАММА","Набор команд для компьютера","💻"],["СВЕТОФОР","Устройство с цветными сигналами на дороге","🚦"],["САМОЛЁТИК","Маленькая модель воздушного судна","✈️"],["ЧЕРЕПАХА","Животное с панцирем","🐢"],
  ["АКУЛА","Большая хищная рыба","🦈"],["АРБУЗ","Большая ягода с зелёной коркой","🍉"],["БАНАН","Жёлтый изогнутый фрукт","🍌"],["БИЛЕТ","Документ для прохода или поездки","🎟️"],["ВИЛКА","Столовый прибор с зубцами","🍴"],["ГРИБЫ","То, что собирают в лесу после дождя","🍄"],["ДВЕРЬ","То, через что входят в комнату","🚪"],["ЖИРАФ","Животное с очень длинной шеей","🦒"],["ЗЕБРА","Полосатое африканское животное","🦓"],["КНИГА","Печатное произведение для чтения","📚"],["ЛАМПА","Предмет, который освещает комнату","💡"],["ЛИМОН","Жёлтый кислый цитрус","🍋"],["МЕТРО","Подземный городской транспорт","🚇"],["МЫШЬ","Маленький грызун или компьютерный манипулятор","🐭"],["ОКЕАН","Огромное пространство солёной воды","🌊"],["ПАЛЕЦ","Одна из частей кисти руки","☝️"],["ПЛЕД","Тёплое покрывало","🧶"],["ПОЧТА","Служба доставки писем и посылок","📮"],["САЛЮТ","Праздничные огни в небе","🎆"],["САХАР","Сладкие кристаллы для чая","🧂"],["ТЕАТР","Место, где показывают спектакли","🎭"],["ТИГР","Полосатая большая кошка","🐅"],["ТУЧА","Большое скопление облаков","🌧️"],["УТЮГ","Прибор для разглаживания одежды","♨️"],["ФАКЕЛ","Горящая палка для освещения","🔥"],["ЦИРК","Место выступлений акробатов и клоунов","🎪"],["ЧАСЫ","Прибор для определения времени","⌚"],["ШАРФ","Тёплая вещь, которую носят на шее","🧣"],["ЯХТА","Небольшое прогулочное судно","⛵"],
  ["АКТ","Часть пьесы","🎭"],["БОК","Боковая часть тела","🧍"],["ГОД","Период в двенадцать месяцев","📅"],["ДОМ","Здание для жилья","🏠"],["ЁЖ","Колючее лесное животное","🦔"],["ЖУК","Насекомое с твёрдыми крыльями","🐞"],["ЗАЛ","Большое помещение для собраний","🏛️"],["ЛЁД","Замёрзшая вода","🧊"],["ЛУК","Овощ или оружие со стрелами","🧅"],["МЯЧ","Предмет для многих спортивных игр","⚽"],["НОС","Орган обоняния на лице","👃"],["РАЙ","Место вечного блаженства в религии","🌈"],["РОТ","Отверстие для еды и речи","👄"],["САД","Участок, где растут деревья и цветы","🌳"],["СОН","Состояние отдыха ночью","😴"],["ТОК","Движение электрического заряда","⚡"],["ЧАЙ","Популярный горячий напиток","🍵"],["ШАГ","Одно движение при ходьбе","👣"],
  ["АКТ","Часть пьесы","🎭"],["БОЙ","Сражение или поединок","🥊"],["ВЕК","Промежуток в сто лет","⌛"],["ВИД","То, что можно увидеть; облик","👀"],["ДНО","Нижняя часть сосуда или водоёма","🫙"],["ЖАР","Сильный нагрев или высокая температура","🌡️"],["ЗУБ","Твёрдая часть во рту","🦷"],["КИТ","Крупнейшее морское млекопитающее","🐋"],["ЛЕС","Место, где растёт много деревьев","🌲"],["МИР","Отсутствие войны или планета людей","🕊️"],["РАК","Знак зодиака и речное животное","🦀"],["РОК","Музыкальное направление","🎸"],["СЫР","Молочный продукт","🧀"],["ТОН","Оттенок звука или цвета","🎨"],["ХОД","Действие игрока в настольной игре","♟️"],

  ["АБРИКОС","Сочный плод с косточкой","🍑"],["АВТОР","Создатель произведения","✍️"],["АДРЕС","Место проживания или расположения","📍"],["АКВАРЕЛЬ","Краски, разводимые водой","🎨"],["АККУМУЛЯТОР","Устройство для накопления энергии","🔋"],["АЛГОРИТМ","Последовательность действий для решения задачи","🧩"],["АЛМАЗ","Очень твёрдый драгоценный минерал","💎"],["АНАЛИЗ","Изучение частей и свойств чего-либо","🔎"],["АНГЕЛ","Небесный посланник в религиозных представлениях","👼"],["АНЕКДОТ","Короткая смешная история","😄"],["АРЕНА","Площадка для спортивных состязаний","🏟️"],["АРХИВ","Хранилище документов","🗄️"],["АСТРОНОМ","Учёный, изучающий космос","🔭"],
  ["БАГАЖ","Вещи пассажира в поездке","🧳"],["БАЛКОН","Выступающая площадка у здания","🏢"],["БАРХАТ","Мягкая ткань с густым ворсом","🧵"],["БЕГЕМОТ","Крупное животное, живущее у воды","🦛"],["БЕЛОК","Питательное вещество в пище","🥚"],["БЕРЕГ","Край водоёма","🏖️"],["БЕСЕДА","Разговор нескольких людей","💬"],["БИОЛОГИЯ","Наука о живых организмах","🧬"],["БЛАГОТВОРИТЕЛЬ","Человек, помогающий другим","🤝"],
  ["ВАГОН","Часть железнодорожного состава","🚃"],["ВАЛЮТА","Денежная единица страны","💶"],["ВАРЕНЬЕ","Сладкая заготовка из ягод или фруктов","🍓"],["ВЕЛОСИПЕД","Транспорт с двумя колёсами и педалями","🚲"],["ВЕСТИБЮЛЬ","Входное помещение здания","🚪"],["ВЕТЕР","Движение воздуха","🌬️"],["ВИТРИНА","Застеклённое место для показа товаров","🪟"],["ВОДОПРОВОД","Система подачи воды по трубам","🚰"],["ВОЗДУХ","Смесь газов вокруг Земли","🌫️"],
  ["ГАЗЕТА","Печатное издание с новостями","📰"],["ГАЛАКТИКА","Огромная система звёзд","🌌"],["ГАРАЖ","Помещение для автомобиля","🚗"],["ГАРМОНИЯ","Согласованность частей целого","🎼"],["ГЕРОЙ","Человек, совершивший смелый поступок","🦸"],["ГИГАНТ","Кто-то или что-то очень большое","🏔️"],["ГРАМОТНОСТЬ","Умение правильно читать и писать","📖"],["ГРАФИКА","Вид изобразительного искусства","🖼️"],
  ["ДВИГАТЕЛЬ","Механизм, приводящий машину в движение","⚙️"],["ДЕЛЬФИН","Умное морское млекопитающее","🐬"],["ДЕРЕВНЯ","Небольшое сельское поселение","🏡"],["ДИАЛОГ","Разговор двух или нескольких лиц","🗣️"],["ДИПЛОМ","Документ об окончании учебного заведения","🎓"],["ДОКТОР","Врач или обладатель учёной степени","🩺"],["ДОКУМЕНТ","Официальная бумага с информацией","📄"],
  ["ЖЕЛЕЗО","Металл, используемый в строительстве","🔩"],["ЖУРНАЛ","Периодическое печатное издание","📔"],["ЗАВОД","Промышленное предприятие","🏭"],["ЗАКАТ","Исчезновение солнца за горизонтом","🌇"],["ЗАПИСКА","Короткое письменное сообщение","📝"],["ЗДАНИЕ","Постройка для разных целей","🏢"],["ЗОЛОТО","Драгоценный жёлтый металл","🥇"],
  ["ИГРУШКА","Предмет для детской игры","🧸"],["ИЗУМРУД","Драгоценный камень зелёного цвета","💚"],["ИНЖЕНЕР","Специалист по техническим разработкам","👷"],["ИНСТРУМЕНТ","Предмет для выполнения работы","🛠️"],["ИНТЕРЕС","Любопытство к чему-либо","❔"],["ИСКУССТВО","Творческое отражение мира","🎭"],
  ["КАБИНЕТ","Отдельная комната для работы","🚪"],["КАЛЬЦИЙ","Химический элемент, важный для костей","🦴"],["КАМЕРА","Устройство для съёмки или помещение","📷"],["КАМЕНЬ","Твёрдая горная порода","🪨"],["КАНИКУЛЫ","Перерыв в занятиях в учебном заведении","🏖️"],["КАРТИНА","Произведение живописи","🖼️"],["КАТАЛОГ","Список предметов или товаров","📋"],["КВАРТИРА","Жилое помещение в многоквартирном доме","🏠"],["КИНОТЕАТР","Заведение для просмотра фильмов","🎬"],["КЛАССИКА","Образцовые произведения искусства","🎻"],["КЛИМАТ","Многолетний режим погоды местности","🌦️"],["КОЛЛЕКЦИЯ","Собрание однородных предметов","🗃️"],["КОМАНДА","Группа людей, работающих вместе","👥"],["КОМПЬЮТЕР","Электронное устройство для обработки данных","🖥️"],["КОНВЕРТ","Бумажная оболочка для письма","✉️"],["КОРАБЛЬ","Крупное морское судно","🚢"],["КОРИДОР","Проход внутри здания","🚶"],["КОСМОНАВТ","Человек, совершающий полёт в космос","🧑‍🚀"],["КРОКОДИЛ","Крупная хищная рептилия","🐊"],
  ["ЛАБОРАТОРИЯ","Помещение для научных исследований","🧪"],["ЛАСТОЧКА","Небольшая перелётная птица","🐦"],["ЛЕГЕНДА","Предание о прошлом","📜"],["ЛИСТОПАД","Осеннее опадание листьев","🍂"],["ЛОКОМОТИВ","Железнодорожная тяга","🚂"],["ЛОПАТА","Инструмент для копания земли","🪏"],
  ["МАГАЗИН","Место продажи товаров","🏬"],["МАКАРОНЫ","Изделия из теста для варки","🍝"],["МАНДАРИН","Небольшой цитрусовый фрукт","🍊"],["МАТЕРИК","Крупный массив суши","🌍"],["МЕДВЕДЬ","Крупный лесной зверь","🐻"],["МЕДИЦИНА","Область знаний о здоровье и лечении","🏥"],["МЕЛОДИЯ","Последовательность музыкальных звуков","🎶"],["МИКРОСКОП","Прибор для изучения очень малых объектов","🔬"],["МИНУТА","Единица времени из шестидесяти секунд","⏱️"],["МОРЯК","Человек, работающий на судне","⚓"],
  ["НАБЛЮДАТЕЛЬ","Тот, кто внимательно следит за событиями","👁️"],["НАСЕКОМОЕ","Маленькое членистоногое с шестью ногами","🐞"],["НАСТРОЕНИЕ","Внутреннее эмоциональное состояние","🙂"],["НЕБО","Пространство над поверхностью Земли","🌤️"],["НОВОСТИ","Сообщения о недавних событиях","📡"],
  ["ОБЛАКО","Скопление капель воды в атмосфере","☁️"],["ОБРАЗОВАНИЕ","Получение знаний и навыков","🎓"],["ОБЪЕКТИВ","Оптическая часть фотоаппарата","📷"],["ОГОНЁК","Маленькое пламя или источник света","🔥"],["ОРКЕСТР","Коллектив музыкантов","🎻"],["ОТКРЫТКА","Карточка для короткого поздравления","💌"],
  ["ПАЛАТКА","Переносное жилище из ткани","⛺"],["ПАМЯТНИК","Сооружение в память о событии или человеке","🗿"],["ПАРОВОЗ","Локомотив с паровым двигателем","🚂"],["ПАСПОРТ","Документ, удостоверяющий личность","🛂"],["ПЕЙЗАЖ","Изображение природы или местности","🏞️"],["ПЕРЕХОД","Место или действие пересечения дороги","🚸"],["ПИАНИНО","Клавишный музыкальный инструмент","🎹"],["ПЛАНЕТА","Небесное тело, обращающееся вокруг звезды","🪐"],["ПЛАНШЕТ","Портативный компьютер с сенсорным экраном","📱"],["ПЛАСТИЛИН","Мягкий материал для лепки","🎨"],["ПЛОЩАДЬ","Открытое пространство в городе","🏙️"],["ПОГОДА","Состояние атмосферы в данный момент","🌦️"],["ПОЗДРАВЛЕНИЕ","Добрые слова по случаю праздника","🎉"],["ПОЛИКЛИНИКА","Медицинское учреждение для приёма пациентов","🏥"],["ПОРТРЕТ","Изображение конкретного человека","🖼️"],["ПОСОЛЬСТВО","Представительство государства за рубежом","🏛️"],["ПРЕДПРИЯТИЕ","Организация, производящая товары или услуги","🏭"],["ПРИБОР","Устройство для измерения или работы","🔧"],["ПРИРОДА","Всё существующее вне деятельности человека","🌳"],["ПРОВОДНИК","Работник, сопровождающий пассажиров в поезде","🚆"],
  ["РАДИО","Передача звука на расстояние","📻"],["РАДУГА","Цветная дуга после дождя","🌈"],["РАКОВИНА","Чаша для мытья рук","🚰"],["РАСТЕНИЕ","Живой организм, обычно растущий в земле","🌱"],["РЕАКТОР","Устройство для проведения управляемой реакции","⚛️"],["РЕКЛАМА","Информация для привлечения внимания к товару","📣"],["РЕПОРТАЖ","Сообщение журналиста с места события","🎤"],["РЕСТОРАН","Заведение общественного питания","🍽️"],["РЕЦЕПТ","Описание способа приготовления блюда","📜"],["РОМАШКА","Полевой цветок с белыми лепестками","🌼"],
  ["САМОЛЁТ","Летательный аппарат с крыльями","✈️"],["САНАТОРИЙ","Учреждение для отдыха и оздоровления","🏨"],["СВЕРЧОК","Насекомое, издающее характерный стрекот","🦗"],["СИГНАЛ","Знак или звук, передающий сообщение","🚦"],["СИСТЕМА","Набор связанных между собой частей","⚙️"],["СКУЛЬПТУРА","Объёмное произведение искусства","🗿"],["СЛОВАРЬ","Собрание слов с объяснениями","📚"],["СМАРТФОН","Мобильный телефон с функциями компьютера","📱"],["СОБРАНИЕ","Встреча людей для обсуждения вопросов","👥"],["СОЛОВЕЙ","Певчая птица с красивым голосом","🐦"],["СПЕКТАКЛЬ","Театральное представление","🎭"],["СТАНЦИЯ","Место остановки транспорта или работы оборудования","🚉"],["СТРОИТЕЛЬ","Человек, возводящий здания","👷"],["СУВЕНИР","Памятная вещь из поездки","🎁"],
  ["ТАЛАНТ","Выдающаяся природная способность","⭐"],["ТЕЛЕСКОП","Прибор для наблюдения за далёкими объектами","🔭"],["ТЕПЛОХОД","Судно с механическим двигателем","🚢"],["ТЕРРИТОРИЯ","Часть земной поверхности с границами","🗺️"],["ТЕХНИКА","Совокупность машин и устройств","⚙️"],["ТРАМВАЙ","Городской транспорт на рельсах","🚋"],["ТРАНСПОРТ","Средства для перевозки людей и грузов","🚍"],
  ["УВЛЕЧЕНИЕ","Занятие, вызывающее сильный интерес","🎯"],["УРАГАН","Очень сильный разрушительный ветер","🌪️"],["УЧЕБНИК","Книга для изучения предмета","📘"],
  ["ФАБРИКА","Промышленное предприятие по производству товаров","🏭"],["ФЕЙЕРВЕРК","Праздничное зрелище из разноцветных огней","🎆"],["ФИЛЬМ","Произведение кинематографа","🎞️"],["ФИЛОСОФИЯ","Наука о наиболее общих вопросах мира и мышления","💭"],["ФОТОГРАФИЯ","Изображение, полученное фотосъёмкой","📸"],
  ["ХИМИЯ","Наука о веществах и их превращениях","⚗️"],["ХОЗЯЙСТВО","Совокупность имущества и дел","🏡"],["ХУДОЖНИК","Человек, создающий произведения изобразительного искусства","🎨"],
  ["ЦВЕТОК","Часть растения с лепестками","🌷"],["ЦИВИЛИЗАЦИЯ","Развитое общество с культурой и технологиями","🏛️"],["ЦИФРА","Знак для обозначения числа","🔢"],
  ["ЧЕМОДАН","Дорожный контейнер для вещей","🧳"],["ЧЕРНИЛА","Жидкость для письма","🖋️"],["ЧЕРТЁЖ","Изображение предмета с помощью линий","📐"],["ЧИТАТЕЛЬ","Человек, который читает книги","📖"],
  ["ШАХМАТЫ","Настольная игра с королём и фигурами","♟️"],["ШКОЛЬНИК","Ученик школы","🎒"],["ШОКОЛАД","Сладкий продукт из какао","🍫"],["ШОССЕ","Автомобильная дорога","🛣️"],
  ["ЭКВАТОР","Воображаемая линия вокруг середины Земли","🌍"],["ЭКСКУРСИЯ","Познавательная поездка или прогулка","🚌"],["ЭЛЕКТРИЧЕСТВО","Форма энергии, связанная с электрическими зарядами","⚡"],["ЭНЦИКЛОПЕДИЯ","Справочное издание по разным областям знаний","📚"],["ЭСКАЛАТОР","Движущаяся лестница","🛗"],
  ["ЮБИЛЕЙ","Годовщина важного события или даты","🎂"],["ЮНОСТЬ","Период жизни между детством и зрелостью","🌱"],["ЯБЛОКО","Плод яблони","🍎"],["ЯГОДА","Небольшой сочный плод","🫐"],["ЯКОРЬ","Тяжёлое устройство для удержания судна","⚓"]

];

function makeRandomPuzzle(){
  const counts={11:1,8:2,7:5,5:3,4:4,3:3,2:2};
  const chosen=[];
  let used={};
  try{used=JSON.parse(localStorage.getItem("qqcross_used_words_v1")||"{}")||{}}catch(e){used={}}
  for(const [len,count] of Object.entries(counts)){
    const pool=WORD_POOL.filter(x=>Array.isArray(x)&&typeof x[0]==="string"&&x[0].length>0&&Array.from(x[0]).length===+len);
    if(pool.length<count)throw new Error("Недостаточно слов длины "+len);
    let fresh=pool.filter(x=>!used[x[0]]);
    if(fresh.length<count){pool.forEach(x=>delete used[x[0]]);fresh=pool.slice()}
    const shuffled=fresh.slice().sort(()=>Math.random()-.5);
    chosen.push(...shuffled.slice(0,count).map(x=>({answer:x[0],clue:x[1],art:x[2]})));
  }

  const ordered=chosen.slice().sort((a,b)=>b.answer.length-a.answer.length);
  const maxLen=Math.max(...ordered.map(w=>Array.from(w.answer).length));
  puzzle={id:"scanword-"+Date.now(),title:"Сканворд",w:maxLen+4,h:ordered.length,words:[]};
  Object.keys(expected).forEach(k=>delete expected[k]);
  ordered.forEach((w,i)=>{
    const row=i+1, chars=Array.from(w.answer);
    const clueSide=i%2===0?"left":"right";
    const cells=chars.map((_,j)=>[row,clueSide==="left"?j+5:maxLen-j]);
    puzzle.words.push({id:"w"+(i+1),number:i+1,answer:w.answer,clue:w.clue,art:w.art,cells,clueCell:[row,clueSide==="left"?1:maxLen+1],clueSide,dir:"h"});
    cells.forEach((cell,j)=>expected[cell.join(",")]=chars[j]);
  });
  chosen.forEach(w=>used[w.answer]=1);
  try{localStorage.setItem("qqcross_used_words_v1",JSON.stringify(used))}catch(e){}
  return true;
}
function loadPuzzle(){
  const ok=makeRandomPuzzle();
  letterBag=puzzle.words.flatMap(word=>word.answer.split(""));
  const alphabet="АААААААААББВВГДДЕЕЕЕЖЗЗИИИИККЛЛММННННОООООППРРРРСССТТТТУУФХЦЧШЩЫЭЮЯЬ";
  const extra=Math.max(35,Math.ceil(letterBag.length*.55));
  for(let i=0;i<extra;i++)letterBag.push(alphabet[Math.floor(Math.random()*alphabet.length)]);
  for(let i=letterBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[letterBag[i],letterBag[j]]=[letterBag[j],letterBag[i]];}
  return ok;
}
function defaultItems(){return {magnifier:5,clock:5,trash:5}}
function save(){if(state.profile)localStorage.setItem(STORE_KEY,JSON.stringify(state.profile))}
function toast(t){const el=document.createElement("div");el.className="toast";el.textContent=t;document.body.append(el);setTimeout(()=>el.remove(),2300)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){clearInterval(state.interval);const root=$("#app");if(!state.profile){renderRegister(root);return}if(state.screen==="game"){renderGame(root);return}if(state.screen==="lobby"){renderLobby(root);return}renderShell(root)}
function renderRegister(root){root.innerHTML=`<div class="screen"><div class="splash"><div class="logo">QQ</div><h1>QQcross</h1></div><div class="card"><div class="grid2"><button class="btn ${authMode==="signup"?"primary":""}" id="showSignup">Регистрация</button><button class="btn ${authMode==="login"?"primary":""}" id="showLogin">Войти</button></div><h2>${authMode==="signup"?"Создать аккаунт":"Войти в аккаунт"}</h2>${authMode==="signup"?`<label class="small muted">Имя игрока (3–16 символов)</label><input id="username" class="input" maxlength="16" placeholder="Например, wordmaster" autocomplete="username"><h3>Выбери аватарку</h3><div class="avatar-grid">${AVATARS.map((a,i)=>`<button class="avatar-choice ${i===state.selectedAvatar?"selected":""}" data-avatar="${i}">${a}</button>`).join("")}</div>`: ""}<label class="small muted">Электронная почта</label><input id="email" class="input" type="email" placeholder="name@example.com" autocomplete="email"><label class="small muted">Пароль (минимум 8 символов)</label><input id="password" class="input" type="password" placeholder="Пароль" autocomplete="${authMode==="signup"?"new-password":"current-password"}"><button class="btn primary full" id="authSubmit">${authMode==="signup"?"Создать аккаунт":"Войти"}</button><button class="btn full" type="button" id="guestPlay">Играть без регистрации</button><p class="small muted" id="authMessage"></p>${authMode==="signup"?'':""}</div></div>`;
$("#showSignup").onclick=()=>{authMode="signup";renderRegister(root)};$("#showLogin").onclick=()=>{authMode="login";renderRegister(root)};$("#guestPlay").onclick=()=>{const username="Игрок"+String(Date.now()).slice(-4);state.profile={id:"local-"+Date.now(),username,avatar:state.selectedAvatar,coins:0,wins:0,games:0,points:0,items:defaultItems(),friends:[]};save();render();toast("Ты вошёл в гостевом режиме")};
root.querySelectorAll("[data-avatar]").forEach(b=>b.onclick=()=>{state.selectedAvatar=+b.dataset.avatar;renderRegister(root)});
$("#authSubmit").onclick=async()=>{const email=$("#email").value.trim(),password=$("#password").value;const msg=$("#authMessage");if(!supabaseClient){msg.textContent="Не загрузился сервис авторизации. Проверь интернет и обнови страницу.";return}if(!email||!password){msg.textContent="Введи почту и пароль.";return}if(password.length<8){msg.textContent="Пароль должен быть не короче 8 символов.";return}const btn=$("#authSubmit");btn.disabled=true;btn.textContent="Подожди…";try{if(authMode==="signup"){const username=$("#username").value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(username)){msg.textContent="Имя: 3–16 символов, латиница, цифры или _";btn.disabled=false;btn.textContent="Создать аккаунт";return}const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{username,avatar:state.selectedAvatar},emailRedirectTo:"https://mexicanohair2.github.io/QQcross/"}});if(error)throw error;if(data.session){await loadCloudProfile(data.user.id);render()}else{msg.textContent="Аккаунт создан. Проверь почту и подтверди адрес, затем открой «Войти».";authMode="login";btn.disabled=false;btn.textContent="Войти";}}else{const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;await loadCloudProfile(data.user.id);render()}}catch(e){msg.textContent=e.message||"Не удалось выполнить вход.";btn.disabled=false;btn.textContent=authMode==="signup"?"Создать аккаунт":"Войти"}};
}
function renderShell(root){const tabs=["Главная","Друзья","Магазин","Профиль","Настройки"],icons=["⌂","♧","🛍","◉","⚙"];root.innerHTML=`<div class="screen"><div class="top"><div class="user"><div class="avatar">${AVATARS[state.profile.avatar]}</div><div><b>@${esc(state.profile.username)}</b></div></div><div class="coins">🪙 ${state.profile.coins}</div></div>${content()}</div><nav class="nav">${tabs.map((t,i)=>`<button class="${state.tab===t?"active":""}" data-tab="${t}"><span class="ni">${icons[i]}</span>${t}</button>`).join("")}</nav>`;root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});wireContent()}
function content(){if(state.tab==="Друзья")return friends();if(state.tab==="Магазин")return shop();if(state.tab==="Профиль")return profile();if(state.tab==="Настройки")return settings();return home()}
function home(){return `<section class="card hero"><span class="pill">Кроссворд для друзей</span><h2>Собирай слова.<br>Побеждай друзей.</h2><button class="btn primary full" id="createParty">Создать партию</button></section><section class="card row between"><div><b>Случайный кроссворд</b></div><span class="pill">17 слов</span></section><h3 class="section-title">Входящие приглашения</h3>${state.invite?`<div class="notice"><b>Приглашение в партию</b><p class="small muted">От игрока @${esc(state.invite.from)} · ${state.invite.size} участника(ов)</p><div class="grid2"><button class="btn primary" id="acceptInvite">Согласиться</button><button class="btn" id="rejectInvite">Отказаться</button></div></div>`:`<div class="notice"><b>Пока нет приглашений</b></div>`}<h3 class="section-title">Начать игру</h3><div class="card row between"><div><b>Одиночная игра</b></div><button class="btn blue" id="practice">Играть</button></div>`}
function friends(){return `<h2>Друзья</h2><div class="card"><input class="input" id="friendName" placeholder="Имя игрока"><button class="btn primary full" id="addFriend">Добавить друга</button><button class="btn full" id="addTestBot">🤖 Добавить тестового бота @QQcrossBot</button></div><h3 class="section-title">Мои друзья</h3>${(state.profile.friends||[]).length?state.profile.friends.map(n=>`<div class="card row between"><b>@${esc(n)}</b><button class="btn inviteFriend" data-name="${esc(n)}">Пригласить</button></div>`).join(""):`<p class="muted">Список пока пуст.</p>`}`}
function shop(){const products=[["magnifier","🔎","Лупы","Проверка и подсказка"],["clock","⏱","Часы","Добавить 20 секунд"],["trash","🗑️","Мусорки","Заменить набор букв"]];return `<h2>Магазин</h2>${products.map(([key,ico,name,desc])=>`<div class="card"><div class="row"><div class="avatar">${ico}</div><div class="grow"><b>${name}</b><div class="small">В наличии: ${state.profile.items[key]}</div></div></div><div class="grid2 shop-buy"><button class="btn buy" data-item="${key}" data-qty="5">5 шт. · 100 🪙</button><button class="btn primary buy" data-item="${key}" data-qty="10">10 шт. · 200 🪙</button></div></div>`).join("")}`}
function profile(){return `<h2>Профиль</h2><div class="card row"><div class="avatar big">${AVATARS[state.profile.avatar]}</div><div><h3>@${esc(state.profile.username)}</h3><span class="muted small">Игрок QQcross</span></div></div><div class="grid2"><div class="card"><b>${state.profile.wins}</b><div class="muted small">Победы</div></div><div class="card"><b>${state.profile.games}</b><div class="muted small">Матчи</div></div><div class="card"><b>${state.profile.points}</b><div class="muted small">Очки</div></div><div class="card"><b>${state.profile.coins}</b><div class="muted small">Монеты</div></div></div><div class="card"><b>Мои предметы</b><p class="small">🔎 Лупы: ${state.profile.items.magnifier}　⏱ Часы: ${state.profile.items.clock}　🗑️ Мусорки: ${state.profile.items.trash}</p></div><button class="btn danger full" id="logout">Сбросить демо-профиль</button>`}
function settings(){
  const themes=[["purple","Фиолетовый","Мягкий сливовый градиент"],["burgundy","Бордо","Спокойный винно-бордовый градиент"],["black","Чёрный","Графитовый градиент без ярких цветов"]];
  return `<h2>Настройки</h2>
    <section class="card settings-card">
      <span class="pill">Персонализация</span>
      <h3>Цвет интерфейса</h3>
      
      <div class="theme-list">${themes.map(([key,name,desc])=>`<button class="theme-choice ${activeTheme===key?"selected":""}" data-theme-choice="${key}" aria-pressed="${activeTheme===key}">
        <span class="theme-swatch theme-swatch-${key}"></span>
        <span class="theme-copy"><b>${name}</b></span>
        <span class="theme-check">${activeTheme===key?"✓":""}</span>
      </button>`).join("")}</div>
    </section>
    `;
}
function wireContent(){const cp=$("#createParty");if(cp)cp.onclick=()=>{state.screen="lobby";render()};const pr=$("#practice");if(pr)pr.onclick=()=>begin(1);const ai=$("#acceptInvite");if(ai)ai.onclick=()=>{const size=state.invite.size;state.invite=null;begin(size)};const ri=$("#rejectInvite");if(ri)ri.onclick=()=>{state.invite=null;render();toast("Приглашение отклонено")};const af=$("#addFriend");if(af)af.onclick=()=>{const n=$("#friendName").value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(n)){toast("Проверь имя игрока");return}if(n.toLowerCase()===state.profile.username.toLowerCase()){toast("Нельзя добавить самого себя");return}if(!state.profile.friends.includes(n))state.profile.friends.push(n);save();render();toast("Добавлено в демо-список")};const bot=$("#addTestBot");if(bot)bot.onclick=()=>{const n="QQcrossBot";if(!state.profile.friends.includes(n))state.profile.friends.push(n);save();render();toast("Тестовый бот добавлен в друзья")};document.querySelectorAll(".inviteFriend").forEach(b=>b.onclick=()=>{if(b.dataset.name.toLowerCase()==="qqcrossbot"){state.invite={from:"QQcrossBot 🤖",size:2,bot:true};state.screen="";state.tab="Главная";render();toast("Бот получил приглашение (демо)")}else openInvite(b.dataset.name)});document.querySelectorAll(".buy").forEach(b=>b.onclick=()=>{const qty=+b.dataset.qty,cost=qty===5?100:200;if(state.profile.coins<cost){toast("Не хватает монет");return}state.profile.coins-=cost;state.profile.items[b.dataset.item]+=qty;save();render();toast(`Куплено: ${qty} шт.`)});const lo=$("#logout");if(lo)lo.onclick=async()=>{if(confirm("Выйти из аккаунта на этом устройстве?")){if(supabaseClient)await supabaseClient.auth.signOut();localStorage.removeItem(STORE_KEY);state.profile=null;render()}};document.querySelectorAll("[data-theme-choice]").forEach(b=>b.onclick=()=>{applyTheme(b.dataset.themeChoice);render();toast("Оформление изменено")})}
function renderLobby(root){root.innerHTML=`<div class="screen"><div class="top"><button class="btn" id="back">← Назад</button><div class="coins">🪙 ${state.profile.coins}</div></div><h2>Новая партия</h2><div class="card"><b>Сколько игроков будет в партии?</b><div class="party-options">${[2,3,4].map(n=>`<button class="party-option ${state.partySize===n?"selected":""}" data-size="${n}">${n}</button>`).join("")}</div><label class="small muted">Кого пригласить?</label><input id="inviteName" class="input" placeholder="Username друга"><button class="btn primary full" id="sendInvite">Отправить приглашение</button></div><div class="card"><button class="btn full" id="demoInvite">Показать входящее приглашение (демо)</button></div>`;$("#back").onclick=()=>{state.screen="";render()};root.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{state.partySize=+b.dataset.size;renderLobby(root)});$("#sendInvite").onclick=()=>{const n=$("#inviteName").value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(n)){toast("Введи username друга");return}openInvite(n)};$("#demoInvite").onclick=()=>{state.invite={from:"friend_demo",size:state.partySize};state.screen="";state.tab="Главная";render()}}
function openInvite(name){state.invite={from:name,size:state.partySize};state.screen="";state.tab="Главная";render();toast("Демо-приглашение создано")}
function begin(size=1){try{if(!loadPuzzle())return}catch(error){console.error("QQcross puzzle generation:",error);toast(error&&error.message?error.message:"Не удалось создать кроссворд. Попробуй ещё раз.");return}state.screen="game";state.partySize=size;state.filled={};state.owners={};state.feedback={};state.hints={};state.loupeActive=false;state.completed=new Set();state.scores=0;state.playerScores=Array(size).fill(0);state.turn=0;state.round=1;state.seconds=60;state.rackNeedsRefill=Array(size).fill(false);state.playerRacks=Array.from({length:size},()=>drawLetters(7));state.letters=state.playerRacks[0];state.selectedLetter=-1;state.selectedCell=null;state.selectedWord="w1";state.pendingMoves=[];render()}
function drawLetters(n){
  const out=[];
  for(let i=0;i<n&&letterBag.length;i++){
    const index=Math.floor(Math.random()*letterBag.length);
    out.push(letterBag.splice(index,1)[0]);
  }
  return out;
}
function ensureWordLetter(){const w=currentWord(),c=nextCell(w);if(!c)return;const needed=expected[c.join(",")];if(!state.letters.includes(needed)&&state.letters.length)state.letters[state.letters.length-1]=needed}
function currentWord(){return puzzle.words.find(w=>!state.completed.has(w.id))||puzzle.words[0]}
function nextCell(word){return word.cells.find(c=>!state.filled[c.join(",")])}
function pictureUrl(emoji){
  const code=Array.from(emoji).map(ch=>ch.codePointAt(0).toString(16)).filter(x=>x!=="fe0f"&&x!=="fe0e").join("-");
  return "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/"+code+".png";
}
function renderGame(root){
  clearInterval(state.interval);
  if(!state.playerRacks)state.playerRacks=Array.from({length:state.partySize},()=>drawLetters(7));
  if(state.rackNeedsRefill&&state.rackNeedsRefill[state.turn]){refillRack(state.turn);state.rackNeedsRefill[state.turn]=false;}
  state.letters=state.playerRacks[state.turn]||[];
  state.pendingMoves=state.pendingMoves||[];
  const pending={};state.pendingMoves.forEach(m=>pending[m.k]=m.l);

  const boardW=puzzle.w,boardH=puzzle.h;
  const viewportWidth=Math.floor(window.visualViewport?.width||window.innerWidth);
  const cellSize=Math.max(8,Math.floor((viewportWidth-12)/boardW));
  const rows=[];
  for(let y=1;y<=boardH;y++){
    const word=puzzle.words.find(w=>w.cells[0][0]===y);
    if(!word)continue;
    const clue='<div class="cell clue-tile scan-clue" role="note"><span class="scan-arrow">'+(word.clueSide==="right"?"◀":"▶")+'</span><span class="scan-clue-text">'+esc(word.clue)+'</span></div>';
    const visualCells=word.cells.slice().sort((a,b)=>a[1]-b[1]);
    const letters=visualCells.map(pos=>{
      const k=pos.join(","),letter=state.filled[k]||pending[k]||"",hint=state.hints[k];
      const selectedCell=state.selectedWord===word.id;
      const cls="cell "+(letter?"filled ":"")+(pending[k]?"pending-cell ":"")+(selectedCell?"selected-word-cell ":"")+(state.feedback[k]==="correct"?"feedback-correct ":"")+(state.feedback[k]==="wrong"?"feedback-wrong ":"")+(hint&&!letter?"has-phantom ":"");
      return '<div class="'+cls+'" data-cell="'+k+'"><span class="cell-letter">'+esc(letter)+'</span>'+(hint&&!letter?'<span class="phantom-letter">'+esc(hint)+'</span>':"")+'</div>';
    }).join("");
    const rowContent=word.clueSide==="right"?letters+clue:clue+letters;
    rows.push('<div class="scanword-row" style="--scan-cell:'+cellSize+'px">'+rowContent+'</div>');
  }
  const names=Array.from({length:state.partySize},(_,i)=>i===0?'Ты':'Игрок '+(i+1));
  const scores=names.map((n,i)=>'<span class="'+(i===state.turn?'active-player':'')+'">'+n+': '+((state.playerScores||[])[i]||0)+'</span>').join("");
  root.innerHTML='<div class="screen game-screen"><div class="top"><button class="btn" id="exit">← Выйти</button><button class="btn" id="refresh-page" type="button">↻ Обновить</button><div class="timer" id="timer">⏱ '+state.seconds+'</div></div>'+
    '<div class="game-head"><div><b>QQСканворд</b><div class="small muted">'+(state.partySize===1?'Тренировка':'Партия · '+state.partySize+' игрока(ов)')+' · Ход: '+names[state.turn]+'</div></div><span class="pill">Раунд '+(state.round||1)+' · '+(state.turn+1)+'/'+state.partySize+'</span></div>'+
    '<div class="score-strip">'+scores+'</div><div class="board-wrap scanword-wrap"><div class="scanword-board">'+rows.join("")+'</div></div>'+
    '<div class="game-tools"><div class="letter-area"><span class="letter-label">Буквы</span><div class="hand">'+state.letters.map((l,i)=>'<button class="letter" data-letter="'+i+'">'+esc(l)+'</button>').join("")+'</div><button class="btn primary check-turn" id="endturn">✓</button></div>'+
    '<div class="items"><button class="item" id="magnifier"><strong>🔎 '+state.profile.items.magnifier+'</strong>Лупа</button><button class="item" id="clock"><strong>⏱ '+state.profile.items.clock+'</strong>Часы</button><button class="item" id="trash"><strong>🗑️ '+state.profile.items.trash+'</strong>Мусорка</button></div>'+
    '<p class="game-hint">Перетащи буквы в пустые клетки. ✓ проверяет расстановку и передаёт ход.</p></div></div>';
  // Старые панели со списком вопросов больше не используются.
  root.querySelectorAll(".questions,.clue-panel,.clue-list-readable,.clue-heading,.clue-title,.clue-row").forEach(el=>el.remove());
  // Подсказки сканворда отображаются прямо в клетках; отдельные всплывающие вопросы не нужны.
  root.querySelectorAll("[data-cell]").forEach(cell=>cell.addEventListener("click",()=>{if(!state.loupeActive)return;const k=cell.dataset.cell;if(expected[k]===undefined||state.filled[k]||state.pendingMoves.some(m=>m.k===k))return;if(!useItem("magnifier")){state.loupeActive=false;return}state.hints[k]=expected[k];state.loupeActive=false;renderGame(root);toast("Буква подсвечена. Поставь её настоящей буквой позже.");}));
  let dragIndex=-1,dragPointer=-1,dragButton=null,dragGhost=null,hoverCell=null,hoverClue=null;
  const clearDrag=()=>{
    if(dragButton)dragButton.classList.remove("dragging");
    if(hoverCell)hoverCell.classList.remove("drop-hover");
    if(hoverClue)hoverClue.classList.remove("drop-clue-hover");
    dragIndex=-1;dragPointer=-1;dragButton=null;hoverCell=null;hoverClue=null;
    document.removeEventListener("pointermove",onMove);
    document.removeEventListener("pointerup",onUp);
    document.removeEventListener("pointercancel",onCancel);
  };
  const moveGhost=(x,y)=>{
    if(!dragGhost)return;
    const w=dragGhost.offsetWidth,h=dragGhost.offsetHeight;
    dragGhost.style.transform="translate3d("+(x-w/2)+"px,"+(y-h/2)+"px,0) scale(1.12)";
    const under=document.elementsFromPoint(x,y);
    const clue=under.map(el=>el.closest&&el.closest("[data-show-clue]")).find(Boolean);
    const cell=clue?null:under.map(el=>el.closest&&el.closest("[data-cell]")).find(el=>el&&expected[el.dataset.cell]!==undefined);
    if(hoverClue!==clue){if(hoverClue)hoverClue.classList.remove("drop-clue-hover");hoverClue=clue;if(hoverClue)hoverClue.classList.add("drop-clue-hover")}
    if(hoverCell!==cell){if(hoverCell)hoverCell.classList.remove("drop-hover");hoverCell=cell;if(hoverCell)hoverCell.classList.add("drop-hover")}
  };
  const onMove=e=>{
    if(dragIndex<0||e.pointerId!==dragPointer)return;
    moveGhost(e.clientX,e.clientY);e.preventDefault();
  };
  const onUp=e=>{
    if(dragIndex<0||e.pointerId!==dragPointer)return;
    const under=document.elementsFromPoint(e.clientX,e.clientY);
    const clueButton=under.map(el=>el.closest&&el.closest("[data-show-clue]")).find(Boolean);
    const cell=clueButton?null:under.map(el=>el.closest&&el.closest("[data-cell]")).find(el=>el&&expected[el.dataset.cell]!==undefined);
    const index=dragIndex,ghost=dragGhost;
    const valid=cell&&!state.filled[cell.dataset.cell]&&!state.pendingMoves.some(m=>m.k===cell.dataset.cell);
    clearDrag();dragGhost=null;
    if(ghost&&clueButton){ghost.remove();showClue(clueButton.dataset.showClue);e.preventDefault();return}
    if(ghost&&valid){
      const r=cell.getBoundingClientRect();
      ghost.style.transition="transform 180ms cubic-bezier(.2,.8,.2,1),opacity 180ms";
      ghost.style.transform="translate3d("+r.left+"px,"+r.top+"px,0) scale(.72)";
      ghost.style.opacity=".25";
      setTimeout(()=>{ghost.remove();placeAtCell(cell.dataset.cell,index,root)},185);
    }else if(ghost){
      ghost.style.transition="transform 140ms ease,opacity 140ms ease";
      ghost.style.opacity="0";ghost.style.transform+=" scale(.75)";
      setTimeout(()=>ghost.remove(),145);
    }
    e.preventDefault();
  };
  const onCancel=e=>{
    if(dragIndex<0||e.pointerId!==dragPointer)return;
    const ghost=dragGhost;clearDrag();dragGhost=null;
    if(ghost){ghost.style.transition="opacity 120ms";ghost.style.opacity="0";setTimeout(()=>ghost.remove(),125)}
  };
  root.querySelectorAll("[data-letter]").forEach(b=>{
    b.addEventListener("pointerdown",e=>{
      if(dragIndex!==-1)return;
      dragIndex=Number(b.dataset.letter);dragPointer=e.pointerId;dragButton=b;
      const r=b.getBoundingClientRect();
      dragGhost=b.cloneNode(true);dragGhost.classList.add("drag-ghost");
      Object.assign(dragGhost.style,{position:"fixed",left:"0",top:"0",width:r.width+"px",height:r.height+"px",margin:"0",zIndex:"99999",pointerEvents:"none",transition:"none",opacity:"1",transform:"translate3d("+r.left+"px,"+r.top+"px,0) scale(1.05)"});
      document.body.appendChild(dragGhost);b.classList.add("dragging");
      moveGhost(e.clientX,e.clientY);
      document.addEventListener("pointermove",onMove,{passive:false});
      document.addEventListener("pointerup",onUp);
      document.addEventListener("pointercancel",onCancel);
      e.preventDefault();
    });
  });
  $("#refresh-page").onclick=()=>window.location.reload();
  $("#exit").onclick=()=>{if(state.pendingMoves.length&&!confirm("Незавершённые буквы этого хода будут потеряны. Выйти?"))return;state.pendingMoves=[];state.screen="";render()};
  $("#endturn").onclick=()=>finishTurn(root);
  $("#magnifier").onclick=()=>{if(state.profile.items.magnifier<=0){toast("Лупы закончились — загляни в магазин");return}state.loupeActive=true;toast("Лупа активна: нажми на пустую клетку");};
  $("#clock").onclick=()=>{if(!useItem("clock"))return;state.seconds+=20;renderGame(root)};
  $("#trash").onclick=()=>{if(!useItem("trash"))return;state.playerRacks[state.turn]=[];state.letters=state.playerRacks[state.turn];refillRack(state.turn);renderGame(root)};
  $("#magnifier").onclick=()=>{if(!useItem("magnifier"))return;const w=puzzle.words[0],next=w.cells.find(c=>!state.filled[c.join(",")]&&!state.pendingMoves.some(m=>m.k===c.join(",")));if(!next){toast("В этом слове больше нет пустых клеток");return}const k=next.join(","),needed=expected[k],ix=state.letters.indexOf(needed);if(ix>=0){state.letters.splice(ix,1);state.pendingMoves.push({k,l:needed});state.playerRacks[state.turn]=state.letters}renderGame(root);toast("Подсказка добавлена")};
  state.interval=setInterval(()=>{state.seconds--;const t=$("#timer");if(t)t.textContent="⏱ "+state.seconds;if(state.seconds<=0){clearInterval(state.interval);finishTurn(root,true)}},1000);
}
function placeAtCell(k,letterIndex,root){
  if(state.loupeActive){if(expected[k]===undefined||state.filled[k]||state.pendingMoves.some(m=>m.k===k))return;if(!useItem("magnifier")){state.loupeActive=false;return}state.hints[k]=expected[k];state.loupeActive=false;renderGame(root);toast("Буква подсвечена. Поставь её настоящей буквой позже.");return}
  if(expected[k]===undefined||state.filled[k]||state.pendingMoves.some(m=>m.k===k)){toast("Клетка уже занята");return}
  const letter=state.letters[letterIndex];if(!letter)return;
  state.pendingMoves.push({k,l:letter});delete state.feedback[k];state.letters.splice(letterIndex,1);state.playerRacks[state.turn]=state.letters;renderGame(root);
}
function finishTurn(root,timeout=false){
  const moves=state.pendingMoves||[];let correct=0,incorrect=0;
  moves.forEach(m=>{if(state.filled[m.k]){state.letters.push(m.l);return}
    if(m.l===expected[m.k]){state.filled[m.k]=m.l;state.owners[m.k]=state.turn;state.feedback[m.k]="correct";delete state.hints[m.k];state.playerScores[state.turn]++;state.scores++;correct++}
    else{state.feedback[m.k]="wrong";state.letters.push(m.l);incorrect++}
  });
  state.pendingMoves=[];state.playerRacks[state.turn]=state.letters;if(correct)checkWords();
  if(state.screen!=="game"){render();return}
  if(!state.rackNeedsRefill)state.rackNeedsRefill=Array(state.partySize).fill(false);
  state.rackNeedsRefill[state.turn]=true;
  if(state.partySize>1){state.turn=(state.turn+1)%state.partySize;if(state.turn===0)state.round=(state.round||1)+1;}
  else state.round=(state.round||1)+1;
  state.seconds=60;state.selectedLetter=-1;state.letters=state.playerRacks[state.turn];renderGame(root);

}
function refillRack(player){const rack=state.playerRacks[player]||(state.playerRacks[player]=[]);while(rack.length<7&&letterBag.length)rack.push(...drawLetters(Math.min(7-rack.length,letterBag.length)));}
function useItem(key){if(state.profile.items[key]<=0){toast("Предметы закончились — загляни в магазин");return false}state.profile.items[key]--;save();return true}
function place(k,root){
  if(state.selectedLetter<0){toast("Сначала выбери букву");return}
  if(expected[k]===undefined)return;
  if(state.filled[k]){toast("Клетка уже занята");return}
  const l=state.letters[state.selectedLetter];
  if(expected[k]===l){
    state.filled[k]=l;state.owners[k]=state.turn;
    state.letters.splice(state.selectedLetter,1);
    if(letterBag.length)state.letters.push(drawLetters(1)[0]);
    state.playerRacks[state.turn]=state.letters;
    state.selectedLetter=-1;state.selectedCell=null;state.wrong=null;
    state.playerScores[state.turn]++;state.scores++;state.playerRacks[state.turn]=state.letters;
    checkWords();renderGame(root);
  }else{
    state.wrong=k;renderGame(root);
    setTimeout(()=>{state.wrong=null;const el=document.querySelector('[data-cell="'+k+'"]');if(el)el.classList.remove("wrong")},500);
  }
}
function checkWords(){
  puzzle.words.forEach(w=>{
    if(!state.completed.has(w.id)&&w.cells.every(c=>state.filled[c.join(",")]===expected[c.join(",")])){
      state.completed.add(w.id);state.playerScores[state.turn]+=5;state.scores+=5;toast("Слово собрано! +5");
    }
  });
  if(state.completed.size===puzzle.words.length){
    state.profile.games++;state.profile.points+=state.scores;state.profile.coins+=Math.max(10,state.scores);save();state.screen="";
    setTimeout(()=>{render();toast("Партия завершена!")},500);
  }
}
async function loadCloudProfile(userId){const {data,error}=await supabaseClient.from("profiles").select("id,username,avatar,wins,games,points").eq("id",userId).single();if(error)throw error;let saved=null;try{saved=JSON.parse(localStorage.getItem(STORE_KEY)||"null")}catch{}const same=saved&&saved.id===data.id;state.profile={id:data.id,username:data.username,avatar:data.avatar||0,coins:same?(saved.coins||0):0,wins:data.wins||0,games:data.games||0,points:data.points||0,items:same&&saved.items?{...defaultItems(),...saved.items}:defaultItems(),friends:same&&Array.isArray(saved.friends)?saved.friends:[]};save();}
async function initAuth(){
  if(!supabaseClient){render();return}
  let timedOut=false,timer;
  const authTask=(async()=>{
    const {data,error}=await supabaseClient.auth.getSession();
    if(error)throw error;
    if(data.session)await loadCloudProfile(data.session.user.id);
  })();
  authTask.catch(e=>console.error("QQcross auth:",e));
  try{
    await Promise.race([
      authTask,
      new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;reject(new Error("Авторизация не ответила за 6 секунд"))},6000)})
    ]);
  }catch(e){
    console.error("QQcross auth:",e);
    if(timedOut)toast("Сервис аккаунта отвечает слишком долго. Можно продолжить как гость.");
    else toast("Не удалось загрузить аккаунт. Попробуй войти ещё раз.");
  }finally{
    clearTimeout(timer);
    render();
  }
  if(timedOut)authTask.then(()=>render()).catch(()=>{});
}
if("serviceWorker"in navigator)navigator.serviceWorker.getRegistrations().then(registrations=>registrations.forEach(registration=>registration.unregister())).catch(()=>{});
applyTheme(activeTheme);
initAuth();
