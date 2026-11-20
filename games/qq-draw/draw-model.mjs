const MODEL_BASE = "https://cdn.jsdelivr.net/gh/jinnyday0719/quickdraw-resnet@bb1d600a7b2139e0f36cb199eac8ab30dda71e4f/web/tfjs_model";
const MODEL_URL = MODEL_BASE + "/model.json";
const CLASSES_URL = MODEL_BASE + "/class.json";

const CLASS_TO_RUSSIAN = Object.freeze({
  "airplane":"самолет","apple":"яблоко","banana":"банан","basket":"корзина","bear":"медведь",
  "bicycle":"велосипед","bird":"птица","book":"книга","bridge":"мост","bus":"автобус",
  "butterfly":"бабочка","cactus":"кактус","cake":"торт","calculator":"калькулятор","camera":"камера",
  "candle":"свеча","car":"машина","carrot":"морковь","castle":"замок","cat":"кошка",
  "chair":"стул","clock":"часы","cloud":"облако","coffee cup":"чашка","compass":"компас",
  "computer":"компьютер","cookie":"печенье","cow":"корова","crab":"краб","crocodile":"крокодил",
  "cup":"кружка","dog":"собака","dolphin":"дельфин","door":"дверь","dragon":"дракон",
  "duck":"утка","elephant":"слон","envelope":"конверт","eraser":"ластик","eye":"глаз",
  "fish":"рыба","flower":"цветок","frog":"лягушка","giraffe":"жираф","guitar":"гитара",
  "hamburger":"гамбургер","hammer":"молоток","hat":"шляпа","headphones":"наушники",
  "hedgehog":"ежик","helicopter":"вертолет","horse":"лошадь","house":"дом","ice cream":"мороженое",
  "key":"ключ","ladder":"лестница","lantern":"фонарь","laptop":"ноутбук","leaf":"лист",
  "light bulb":"лампочка","lightning":"молния","lion":"лев","mailbox":"почтовый ящик",
  "map":"карта","matches":"спички","microphone":"микрофон","monkey":"обезьяна","moon":"луна",
  "mountain":"гора","mouse":"мышь","mushroom":"гриб","nose":"нос","ocean":"океан",
  "octopus":"осьминог","owl":"сова","palm tree":"пальма","panda":"панда","parrot":"попугай",
  "pear":"груша","pencil":"карандаш","penguin":"пингвин","piano":"пианино","pig":"свинья",
  "pillow":"подушка","pineapple":"ананас","pizza":"пицца","rabbit":"кролик","raccoon":"енот",
  "rain":"дождь","rainbow":"радуга","river":"река","sailboat":"парусник","sandwich":"бутерброд",
  "scissors":"ножницы","shark":"акула","sheep":"овца","shoe":"ботинок","shovel":"лопата",
  "skateboard":"скейтборд","snail":"улитка","snake":"змея","snowflake":"снежинка","snowman":"снеговик",
  "spider":"паук","squirrel":"белка","star":"звезда","strawberry":"клубника","suitcase":"чемодан",
  "sun":"солнце","swan":"лебедь","table":"стол","teapot":"чайник","telephone":"телефон",
  "television":"телевизор","tiger":"тигр","train":"поезд","tree":"дерево","triangle":"треугольник",
  "truck":"грузовик","umbrella":"зонт","vase":"ваза","violin":"скрипка","watermelon":"арбуз",
  "wheel":"колесо","zebra":"зебра"
});

let modelPromise = null;
let loadedModel = null;
let loadedClasses = null;

export function mapQuickDrawPredictions(probabilities, classNames, limit = 6) {
  if (!Array.isArray(probabilities) || !Array.isArray(classNames)) return [];
  return probabilities.map((confidence,index)=>({
    word: CLASS_TO_RUSSIAN[classNames[index]],
    confidence: Number(confidence)
  })).filter(item=>item.word && Number.isFinite(item.confidence) && item.confidence>0.002)
    .sort((a,b)=>b.confidence-a.confidence)
    .filter((item,index,all)=>all.findIndex(other=>other.word===item.word)===index)
    .slice(0,limit);
}

export async function loadDrawingModel() {
  if (loadedModel && loadedClasses) return {model:loadedModel,classes:loadedClasses};
  if (!window.tf?.loadLayersModel) throw new Error("TensorFlow.js не загрузился.");
  if (!modelPromise) {
    modelPromise = Promise.all([
      window.tf.loadLayersModel(MODEL_URL),
      fetch(CLASSES_URL).then(response=>{if(!response.ok)throw new Error("Не удалось загрузить классы модели.");return response.json();})
    ]).then(([model,classes])=>{
      if (!Array.isArray(classes) || classes.length !== model.outputs[0].shape.at(-1)) {
        model.dispose();
        throw new Error("Список классов модели не совпадает с выходом нейросети.");
      }
      loadedModel=model;loadedClasses=classes;
      const warmup=window.tf.zeros([1,28,28,1]);
      const output=model.predict(warmup);
      output.dispose();warmup.dispose();
      return {model,classes};
    }).catch(error=>{modelPromise=null;throw error;});
  }
  return modelPromise;
}

function rasterize(strokes) {
  const canvas=document.createElement("canvas");
  canvas.width=280;canvas.height=280;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.fillStyle="#fff";ctx.fillRect(0,0,280,280);
  const points=(strokes||[]).flatMap(stroke=>(stroke.points||[]).map(point=>({x:Number(point.x),y:Number(point.y)})))
    .filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y));
  if(!points.length)return null;
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
  const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
  const width=Math.max(maxX-minX,0.025),height=Math.max(maxY-minY,0.025);
  const scale=224/Math.max(width,height);
  const offsetX=(280-width*scale)/2-minX*scale;
  const offsetY=(280-height*scale)/2-minY*scale;
  ctx.strokeStyle="#111";ctx.fillStyle="#111";ctx.lineCap="round";ctx.lineJoin="round";
  for(const stroke of strokes||[]){
    const path=(stroke.points||[]).filter(p=>Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y)));
    if(!path.length)continue;
    ctx.lineWidth=Math.max(5,Math.min(18,(Number(stroke.thickness)||5)*1.5));
    ctx.beginPath();
    const first=path[0];ctx.moveTo(first.x*scale+offsetX,first.y*scale+offsetY);
    for(let i=1;i<path.length;i++)ctx.lineTo(path[i].x*scale+offsetX,path[i].y*scale+offsetY);
    if(path.length===1){ctx.arc(first.x*scale+offsetX,first.y*scale+offsetY,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}
    else ctx.stroke();
  }
  return canvas;
}

export async function predictDrawing(strokes) {
  const drawing=rasterize(strokes);
  if(!drawing)return [];
  const {model,classes}=await loadDrawingModel();
  const tf=window.tf;
  let input=null,output=null;
  try{
    input=tf.tidy(()=>{
      const gray=tf.browser.fromPixels(drawing,1);
      const resized=tf.image.resizeBilinear(gray,[28,28]);
      return tf.scalar(1).sub(resized.toFloat().div(255)).expandDims(0);
    });
    output=model.predict(input);
    const probabilities=Array.from(await output.data());
    return mapQuickDrawPredictions(probabilities,classes,6);
  }finally{
    input?.dispose();output?.dispose();
  }
}
