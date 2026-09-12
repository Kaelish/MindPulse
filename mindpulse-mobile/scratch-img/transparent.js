const { Jimp } = require('jimp');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets', 'images');

async function floodFillTransparent(image, tolerance) {
  const { width, height, data } = image.bitmap;
  const idx = (x, y) => (y * width + x) * 4;
  const getPixel = (i) => ({ r: data[i], g: data[i+1], b: data[i+2], a: data[i+3] });

  const samples = [
    getPixel(idx(0,0)), getPixel(idx(width-1,0)),
    getPixel(idx(0,height-1)), getPixel(idx(width-1,height-1)),
    getPixel(idx(Math.floor(width/2),0)),
  ];
  const bg = {
    r: Math.round(samples.reduce((s,p)=>s+p.r,0)/samples.length),
    g: Math.round(samples.reduce((s,p)=>s+p.g,0)/samples.length),
    b: Math.round(samples.reduce((s,p)=>s+p.b,0)/samples.length),
  };
  console.log(`  bg: rgb(${bg.r},${bg.g},${bg.b})`);

  const visited = new Uint8Array(width * height);
  const queue = [];
  const enqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    visited[i] = 1;
    const pi = idx(x, y);
    const p = getPixel(pi);
    if (p.a > 0 &&
        Math.abs(p.r-bg.r)<=tolerance &&
        Math.abs(p.g-bg.g)<=tolerance &&
        Math.abs(p.b-bg.b)<=tolerance) {
      queue.push(x, y);
    }
  };

  for (let x=0;x<width;x++) { enqueue(x,0); enqueue(x,height-1); }
  for (let y=0;y<height;y++) { enqueue(0,y); enqueue(width-1,y); }

  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++], y = queue[qi++];
    data[idx(x,y)+3] = 0;
    enqueue(x+1,y); enqueue(x-1,y); enqueue(x,y+1); enqueue(x,y-1);
  }
  console.log(`  ${qi/2} pixels removed`);
}

async function run() {
  // Re-process book from original JPG source
  const bookJpg = path.join(assetsDir, 'book.jpg');
  const bookPng = path.join(assetsDir, 'book.png');
  console.log('Re-processing book.jpg...');
  const img = await Jimp.read(bookJpg);
  await floodFillTransparent(img, 30);
  await img.write(bookPng);
  console.log('  Saved book.png');

  // Also make the logo transparent from JPG
  const logoJpg = path.join(assetsDir, 'logo.jpg');
  const logoPng = path.join(assetsDir, 'logo.png');
  console.log('\nProcessing logo.jpg...');
  const logo = await Jimp.read(logoJpg);
  await floodFillTransparent(logo, 35);
  await logo.write(logoPng);
  console.log('  Saved logo.png');

  console.log('\nDone!');
}
run();
