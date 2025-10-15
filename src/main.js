const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    backgroundColor: '#071d49',
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'views/login.html'));
  
  // Remove o menu completamente
  mainWindow.setMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler para autenticação KeyAuth via Python
ipcMain.handle('authenticate', async (event, username, password) => {
  return new Promise((resolve, reject) => {
    // Verificar se está em produção (executável) ou desenvolvimento
    const isDev = !app.isPackaged;
    
    let authCommand;
    let authArgs;
    
    // Usar Python em ambos os modos (dev e produção)
    let pythonScript;
    
    if (isDev) {
      // Desenvolvimento: caminho relativo
      pythonScript = path.join(__dirname, '../auth/auth_wrapper.py');
      console.log('Modo DEV - Executando Python script:', pythonScript);
    } else {
      // Produção: caminho em extraResources
      pythonScript = path.join(process.resourcesPath, 'auth/auth_wrapper.py');
      console.log('Modo PRODUÇÃO - Executando Python script:', pythonScript);
    }
    
    authCommand = 'python';
    authArgs = [pythonScript, username, password];
    
    console.log('Username:', username);
    
    const authProcess = spawn(authCommand, authArgs);

    let dataString = '';
    let errorString = '';

    authProcess.stdout.on('data', (data) => {
      dataString += data.toString();
      console.log('Auth stdout:', data.toString());
    });

    authProcess.stderr.on('data', (data) => {
      errorString += data.toString();
      console.error('Auth stderr:', data.toString());
    });

    authProcess.on('close', (code) => {
      console.log('Auth exit code:', code);
      console.log('Auth output:', dataString);
      console.log('Auth errors:', errorString);
      
      if (code === 0 && dataString.trim()) {
        try {
          // Extract JSON from output (KeyAuth library prints messages before JSON)
          const lines = dataString.trim().split('\n');
          let jsonString = '';
          
          // Find the line that starts with { (JSON object)
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('{')) {
              jsonString = trimmedLine;
              break;
            }
          }
          
          if (!jsonString) {
            throw new Error('No JSON found in output');
          }
          
          const result = JSON.parse(jsonString);
          resolve(result);
        } catch (e) {
          console.error('JSON parse error:', e);
          reject({ 
            success: false, 
            message: 'Erro ao processar resposta: ' + dataString.substring(0, 100)
          });
        }
      } else {
        const errorMsg = errorString || dataString || 'Falha na autenticação';
        reject({ 
          success: false, 
          message: errorMsg.substring(0, 200)
        });
      }
    });

    authProcess.on('error', (error) => {
      console.error('Auth spawn error:', error);
      reject({ 
        success: false, 
        message: 'Erro ao executar autenticação: ' + error.message
      });
    });
  });
});

// IPC Handler para carregar painel principal
ipcMain.on('load-panel', () => {
  mainWindow.loadFile(path.join(__dirname, 'views/panel.html'));
});

// IPC Handler para salvar ocorrência
ipcMain.handle('save-occurrence', async (event, data) => {
  try {
    console.log('Dados da ocorrência:', JSON.stringify(data, null, 2));
    
    const fs = require('fs');
    const os = require('os');
    
    // Usar diretório temporário do sistema para evitar conflitos
    const dataDir = path.join(os.tmpdir(), 'secrimpo-pmdf-data');
    
    // Verificar se existe e é um arquivo (não diretório)
    if (fs.existsSync(dataDir)) {
      const stats = fs.statSync(dataDir);
      if (!stats.isDirectory()) {
        // Se for um arquivo, remover
        fs.unlinkSync(dataDir);
      }
    }
    
    // Criar diretório se não existir
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const timestamp = new Date().getTime();
    
    // Salvar JSON (backup)
    const jsonFilename = `ocorrencia_${data.ocorrencia.numeroGenesis}_${timestamp}.json`;
    const jsonFilepath = path.join(dataDir, jsonFilename);
    fs.writeFileSync(jsonFilepath, JSON.stringify(data, null, 2));
    
    // Criar arquivo Excel
    const excelFilename = `ocorrencia_${data.ocorrencia.numeroGenesis}_${timestamp}.xlsx`;
    const excelFilepath = path.join(dataDir, excelFilename);
    
    // Preparar dados para a planilha
    const worksheetData = [
      // Cabeçalhos
      [
        'Timestamp',
        'Nº Genesis',
        'Unidade',
        'Data Apreensão',
        'Lei Infringida',
        'Artigo',
        'Policial Condutor',
        'Espécie',
        'Item',
        'Quantidade',
        'Descrição Item',
        'Ocorrência Item',
        'Proprietário Item',
        'Policial Item',
        'Nome Proprietário',
        'Data Nascimento',
        'Tipo Documento',
        'Nº Documento',
        'Nome Policial',
        'Matrícula',
        'Graduação',
        'Unidade Policial',
        'Registrado Por'
      ],
      // Dados
      [
        new Date().toLocaleString('pt-BR'),
        data.ocorrencia.numeroGenesis,
        data.ocorrencia.unidade,
        data.ocorrencia.dataApreensao,
        data.ocorrencia.leiInfrigida,
        data.ocorrencia.artigo,
        data.ocorrencia.policialCondutor,
        data.itemApreendido.especie,
        data.itemApreendido.item,
        data.itemApreendido.quantidade,
        data.itemApreendido.descricao,
        data.itemApreendido.ocorrencia || '',
        data.itemApreendido.proprietario || '',
        data.itemApreendido.policial || '',
        data.proprietario.nome,
        data.proprietario.dataNascimento,
        data.proprietario.tipoDocumento,
        data.proprietario.numeroDocumento,
        data.policial.nome,
        data.policial.matricula,
        data.policial.graduacao,
        data.policial.unidade,
        data.metadata.registradoPor
      ]
    ];
    
    // Criar workbook e worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Ajustar largura das colunas
    const columnWidths = worksheetData[0].map(() => ({ wch: 20 }));
    worksheet['!cols'] = columnWidths;
    
    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ocorrências');
    
    // Salvar arquivo Excel
    XLSX.writeFile(workbook, excelFilepath);
    console.log('✓ Arquivo Excel criado:', excelFilepath);
    
    // Enviar para Google Sheets (se configurado)
    const GOOGLE_SHEETS_URL = process.env.GOOGLE_SHEETS_URL;
    
    if (GOOGLE_SHEETS_URL) {
      try {
        const https = require('https');
        const url = require('url');
        
        // Preparar dados para envio (formato JSON para Google Apps Script)
        const sheetData = {
          timestamp: new Date().toLocaleString('pt-BR'),
          numeroGenesis: data.ocorrencia.numeroGenesis,
          unidade: data.ocorrencia.unidade,
          dataApreensao: data.ocorrencia.dataApreensao,
          leiInfrigida: data.ocorrencia.leiInfrigida,
          artigo: data.ocorrencia.artigo,
          policialCondutor: data.ocorrencia.policialCondutor,
          especie: data.itemApreendido.especie,
          item: data.itemApreendido.item,
          quantidade: data.itemApreendido.quantidade,
          descricaoItem: data.itemApreendido.descricao,
          ocorrenciaItem: data.itemApreendido.ocorrencia || '',
          proprietarioItem: data.itemApreendido.proprietario || '',
          policialItem: data.itemApreendido.policial || '',
          nomeProprietario: data.proprietario.nome,
          dataNascimento: data.proprietario.dataNascimento,
          tipoDocumento: data.proprietario.tipoDocumento,
          numeroDocumento: data.proprietario.numeroDocumento,
          nomePolicial: data.policial.nome,
          matricula: data.policial.matricula,
          graduacao: data.policial.graduacao,
          unidadePolicial: data.policial.unidade,
          registradoPor: data.metadata.registradoPor,
          // Incluir dados do Excel em base64 para envio
          excelData: fs.readFileSync(excelFilepath).toString('base64'),
          excelFilename: excelFilename
        };
        
        const postData = JSON.stringify(sheetData);
        const parsedUrl = url.parse(GOOGLE_SHEETS_URL);
        
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            // Seguir redirecionamentos (302, 301, 307)
            if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 307) {
              const redirectUrl = res.headers.location;
              console.log('Seguindo redirecionamento para Google Sheets...');
              
              https.get(redirectUrl, (redirectRes) => {
                let responseData = '';
                redirectRes.on('data', (chunk) => { responseData += chunk; });
                redirectRes.on('end', () => {
                  console.log('Dados enviados para Google Sheets:', responseData);
                  resolve();
                });
              }).on('error', (error) => {
                console.error('Erro no redirect para Google Sheets:', error);
                reject(error);
              });
              
              return;
            }
            
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
              console.log('Dados enviados para Google Sheets:', responseData);
              resolve();
            });
          });
          
          req.on('error', (error) => {
            console.error('Erro ao enviar para Google Sheets:', error);
            reject(error);
          });
          
          req.write(postData);
          req.end();
        });
        
        console.log('✓ Dados e Excel enviados para planilha online');
      } catch (sheetError) {
        console.error('Erro ao enviar para planilha:', sheetError);
        // Continua mesmo se falhar o envio para planilha
      }
    }
    
    return { 
      success: true, 
      message: 'Ocorrência registrada com sucesso! Arquivo Excel gerado.',
      file: excelFilename,
      excelPath: excelFilepath
    };
  } catch (error) {
    console.error('Erro ao salvar ocorrência:', error);
    return { 
      success: false, 
      message: 'Erro ao salvar ocorrência: ' + error.message 
    };
  }
});

// IPC Handler para logout
ipcMain.on('logout', () => {
  mainWindow.loadFile(path.join(__dirname, 'views/login.html'));
});
