const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function analyzeEntities() {
  const srcPath = 'C:/it/it_backend/src/main/java';
  const entities = [];
  walkDir(srcPath, (filePath) => {
    if (filePath.endsWith('.java') && (filePath.includes('\\entity\\') || filePath.includes('/entity/'))) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('@Entity') || content.includes('@MappedSuperclass')) {
        const lines = content.split('\n');
        let detCount = 0;
        let retCount = 1; // 기본 1개
        for(let line of lines) {
           if(line.trim().startsWith('private ')) detCount++;
           if(line.includes('@OneToMany') || line.includes('@Embedded') || line.includes('@ElementCollection')) retCount++;
        }
        entities.push({ name: path.basename(filePath, '.java'), det: detCount, ret: retCount });
      }
    }
  });
  console.log("--- ENTITY ANALYSIS ---");
  console.table(entities);
}

function analyzeControllers() {
  const srcPath = 'C:/it/it_backend/src/main/java';
  const controllers = [];
  walkDir(srcPath, (filePath) => {
    if (filePath.endsWith('.java') && (filePath.includes('\\controller\\') || filePath.includes('/controller/'))) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('@RestController') || content.includes('@Controller')) {
        const lines = content.split('\n');
        let endpointCount = 0;
        for(let line of lines) {
           if(line.includes('@GetMapping') || line.includes('@PostMapping') || line.includes('@PutMapping') || line.includes('@DeleteMapping') || line.includes('@PatchMapping')) {
               endpointCount++;
           }
        }
        controllers.push({ name: path.basename(filePath, '.java'), endpoints: endpointCount });
      }
    }
  });
  console.log("--- CONTROLLER ANALYSIS ---");
  console.table(controllers);
}

analyzeEntities();
analyzeControllers();
