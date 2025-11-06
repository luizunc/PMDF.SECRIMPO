const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const XLSX = require('xlsx');
const fs = require('fs');

// Configurar pastas de salvamento
const BASE_DIR = 'C:\\SECRIMPO';
const FOLDERS = {
  ocorrencias: path.join(BASE_DIR, 'Ocorrencias'),
  exportacoes: path.join(BASE_DIR, 'Exportacao'),
  termos: path.join(BASE_DIR, 'Termos')
};

// Criar pastas se não existirem
function ensureFolders() {
  Object.values(FOLDERS).forEach(folder => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  });
}

// Formatar data para nome de arquivo [dd.mm.yyyy]
function formatDateForFilename() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}.${month}.${year}`;
}

// .env não é mais necessário - credenciais estão hardcoded no auth_keyauth.exe
// require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Desabilitar aceleração de hardware para evitar erros de GPU
app.disableHardwareAcceleration();

// Suprimir avisos de GPU no console
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');

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
    icon: path.join(__dirname, '../assets/App_Logo.ico'),
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

// Função para registrar handlers IPC
function registerIPCHandlers() {
  console.log('Registrando handlers IPC...');

  // IPC Handler para upload de PDF para Google Drive
  ipcMain.handle('upload-pdf-attachment', async (event, data) => {
    try {
      console.log('=== INICIANDO UPLOAD DE PDF ===');
      console.log('Dados recebidos:', {
        fileName: data.fileName,
        fileSize: data.fileData?.size,
        occurrence: data.occurrence?.ocorrencia?.numeroGenesis
      });

      const { fileData, occurrence, fileName } = data;

      // Validações
      if (!fileData || !occurrence || !fileName) {
        throw new Error('Dados incompletos para upload');
      }

      // Converter array de bytes para base64
      const buffer = Buffer.from(fileData.data);
      const base64Content = buffer.toString('base64');

      // URL do Google Apps Script configurada
      const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbypVoHlRweEPEH01JH53DGKCYrOhhDQ2VpxnfCOHNjMIj8_0DLQnQBZsZO-JaQhkXXZuQ/exec";

      if (GOOGLE_APPS_SCRIPT_URL.includes('SEU_SCRIPT_ID_AQUI')) {
        console.log('⚠️  URL do Google Apps Script não configurada. Usando modo de teste.');

        // Simular upload bem-sucedido para teste
        const mockResult = {
          success: true,
          fileId: 'mock-file-id-' + Date.now(),
          fileName: fileName,
          fileUrl: 'https://drive.google.com/file/d/mock-file-id/view',
          downloadUrl: 'https://drive.google.com/uc?id=mock-file-id',
          viewUrl: 'https://drive.google.com/file/d/mock-file-id/view',
          size: fileData.size,
          dateCreated: new Date().toISOString(),
          message: 'PDF anexado com sucesso (MODO TESTE)'
        };

        console.log('Resultado simulado:', mockResult);
        return mockResult;
      }

      // Dados para enviar ao Google Apps Script
      const uploadData = {
        action: 'upload',
        numeroGenesis: occurrence.ocorrencia.numeroGenesis,
        unidade: occurrence.ocorrencia.unidade || 'Não informado',
        fileName: fileName,
        fileContent: base64Content
      };

      console.log('Enviando para Google Apps Script:', {
        action: uploadData.action,
        numeroGenesis: uploadData.numeroGenesis,
        unidade: uploadData.unidade,
        fileName: uploadData.fileName,
        contentSize: base64Content.length
      });

      // Fazer requisição para o Google Apps Script
      const fetch = require('node-fetch');
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro HTTP no upload:', response.status);
        console.error('📄 URL utilizada:', GOOGLE_APPS_SCRIPT_URL);
        console.error('🔍 Resposta do servidor:', errorText.substring(0, 500));

        if (response.status === 401) {
          throw new Error('Erro 401: Verifique se o Google Apps Script foi implantado corretamente e se as permissões estão configuradas.');
        } else if (response.status === 404) {
          throw new Error('Erro 404: URL do Google Apps Script não encontrada. Verifique se a URL está correta.');
        } else {
          throw new Error(`Erro HTTP ${response.status}: Falha na comunicação com o Google Apps Script`);
        }
      }

      const result = await response.json();
      console.log('Resposta do Google Apps Script:', result);

      if (result.success) {
        return {
          success: true,
          fileUrl: result.viewUrl || result.fileUrl,
          downloadUrl: result.downloadUrl,
          fileId: result.fileId,
          fileName: result.fileName,
          message: result.message || 'PDF anexado com sucesso!'
        };
      } else {
        throw new Error(result.message || 'Erro desconhecido no upload');
      }

    } catch (error) {
      console.error('Erro no upload do PDF:', error);
      return {
        success: false,
        message: 'Erro ao fazer upload do PDF: ' + error.message
      };
    }
  });

  // IPC Handler para listar anexos de uma ocorrência
  ipcMain.handle('list-pdf-attachments', async (event, numeroGenesis) => {
    try {
      console.log('=== LISTANDO ANEXOS PDF ===');
      console.log('Número Genesis:', numeroGenesis);

      // URL do Google Apps Script configurada (Versão 4)
      const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbypVoHlRweEPEH01JH53DGKCYrOhhDQ2VpxnfCOHNjMIj8_0DLQnQBZsZO-JaQhkXXZuQ/exec";

      if (GOOGLE_APPS_SCRIPT_URL.includes('SEU_SCRIPT_ID_AQUI')) {
        console.log('⚠️  URL do Google Apps Script não configurada. Retornando lista vazia.');

        return {
          success: true,
          attachments: [],
          message: 'Modo de teste - configure o Google Apps Script para ver anexos reais'
        };
      }

      // Fazer requisição GET para listar arquivos
      const fetch = require('node-fetch');
      const url = `${GOOGLE_APPS_SCRIPT_URL}?numeroGenesis=${encodeURIComponent(numeroGenesis)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro HTTP ao listar:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Anexos encontrados:', result);

      if (result.success) {
        return {
          success: true,
          attachments: result.files || [],
          message: result.message
        };
      } else {
        return {
          success: true,
          attachments: [],
          message: 'Nenhum anexo encontrado'
        };
      }

    } catch (error) {
      console.error('Erro ao listar anexos:', error);
      return {
        success: false,
        attachments: [],
        message: 'Erro ao listar anexos: ' + error.message
      };
    }
  });

  // Handlers IPC configurados

  // IPC Handler para deletar anexo PDF
  ipcMain.handle('delete-pdf-attachment', async (event, data) => {
    try {
      console.log('=== DELETANDO ANEXO PDF ===');
      console.log('Dados recebidos:', {
        fileId: data.fileId,
        fileName: data.fileName,
        numeroGenesis: data.numeroGenesis
      });

      const { fileId, fileName } = data;
      
      // Validações
      if (!fileId || !fileName) {
        throw new Error('Dados incompletos para exclusão');
      }

      // URL do Google Apps Script configurada (Versão 4)
      const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbypVoHlRweEPEH01JH53DGKCYrOhhDQ2VpxnfCOHNjMIj8_0DLQnQBZsZO-JaQhkXXZuQ/exec";

      // Dados para enviar ao Google Apps Script
      const deleteData = {
        action: 'delete',
        fileId: fileId
      };

      console.log('Enviando para Google Apps Script:', deleteData);

      // Fazer requisição para o Google Apps Script
      const fetch = require('node-fetch');
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deleteData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro HTTP na exclusão:', response.status);
        console.error('🔍 Resposta do servidor:', errorText.substring(0, 500));
        throw new Error(`Erro HTTP ${response.status}: Falha na comunicação com o Google Apps Script`);
      }

      const result = await response.json();
      console.log('Resposta do Google Apps Script:', result);

      if (result.success) {
        return {
          success: true,
          message: result.message || 'Anexo removido com sucesso!'
        };
      } else {
        throw new Error(result.message || 'Erro desconhecido na exclusão');
      }

    } catch (error) {
      console.error('Erro na exclusão do anexo:', error);
      return {
        success: false,
        message: 'Erro ao remover anexo: ' + error.message
      };
    }
  });

  console.log('Handlers IPC registrados com sucesso!');
}

app.whenReady().then(() => {
  ensureFolders();
  createWindow();

  // Registrar handlers IPC após o app estar pronto
  registerIPCHandlers();

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

    if (isDev) {
      // Desenvolvimento: usar Python script diretamente
      const pythonScript = path.join(__dirname, '../auth/auth_wrapper.py');
      authCommand = 'python';
      authArgs = [pythonScript, username, password];
    } else {
      // Produção: usar executável compilado
      authCommand = path.join(process.resourcesPath, 'auth/auth_keyauth.exe');
      authArgs = [username, password];

      // Verificar se o executável existe
      const fs = require('fs');
      if (!fs.existsSync(authCommand)) {
        // Tentar caminho alternativo
        const alternativePath = path.join(__dirname, '../auth/auth_keyauth.exe');

        if (fs.existsSync(alternativePath)) {
          authCommand = alternativePath;
        } else {
          resolve({
            success: false,
            errorCode: 93,
            errorType: 'EXECUTABLE_NOT_FOUND',
            message: 'Erro 93: Sistema de autenticação não encontrado. Reinstale o aplicativo.'
          });
          return;
        }
      }
    }

    const authProcess = spawn(authCommand, authArgs);

    let dataString = '';
    let errorString = '';

    authProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    authProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    authProcess.on('close', (code) => {

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
          resolve({
            success: false,
            errorCode: 92,
            errorType: 'PARSE_ERROR',
            message: 'Erro 92: Falha ao processar resposta do servidor'
          });
        }
      } else {
        // Tentar extrair JSON de erro do Python (stdout ou stderr)
        try {
          const outputToCheck = dataString.trim() || errorString.trim();
          const lines = outputToCheck.split('\n');
          let jsonString = '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('{')) {
              jsonString = trimmedLine;
              break;
            }
          }

          if (jsonString) {
            const errorResult = JSON.parse(jsonString);
            resolve(errorResult);
            return;
          }
        } catch (e) {
          // Silencioso em produção
        }

        // Se não conseguiu extrair JSON, retornar erro genérico
        resolve({
          success: false,
          errorCode: 95,
          errorType: 'AUTH_ERROR',
          message: 'Erro 95: Falha na autenticação. Verifique suas credenciais.'
        });
      }
    });

    authProcess.on('error', (error) => {
      console.error('Auth spawn error:', error);
      resolve({
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

// Função auxiliar para converter data ISO para formato brasileiro
function isoToBrDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

// IPC Handler para salvar ocorrência
ipcMain.handle('save-occurrence', async (event, data) => {
  try {
    console.log('Dados da ocorrência:', JSON.stringify(data, null, 2));

    // Formato: [NumeroGenesis][dd.mm.yyyy]
    const dateStr = formatDateForFilename();
    const numeroGenesis = data.ocorrencia.numeroGenesis;

    // Salvar JSON (backup) em C:\SECRIMPO\Ocorrencias
    const jsonFilename = `[${numeroGenesis}][${dateStr}].json`;
    const jsonFilepath = path.join(FOLDERS.ocorrencias, jsonFilename);
    fs.writeFileSync(jsonFilepath, JSON.stringify(data, null, 2));

    console.log('✓ JSON salvo em:', jsonFilepath);

    // Enviar para Google Sheets (se configurado)
    const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxY_nB8LrroSxy6KHSb1Jxkm4otWeK0rSjP6OGtGIk63WPcDbXbSv5C9gsCknAEIZRm/exec"; // Cole sua URL do Google Apps Script aqui

    if (GOOGLE_SHEETS_URL) {
      try {
        const https = require('https');
        const url = require('url');

        // Preparar dados para envio (formato array para Google Apps Script)
        // Envia apenas a linha de dados (sem cabeçalhos, pois já existem na planilha)
        const sheetData = {
          values: [
            new Date().toLocaleString('pt-BR'),
            data.ocorrencia.numeroGenesis,
            data.ocorrencia.unidade,
            isoToBrDate(data.ocorrencia.dataApreensao),
            data.ocorrencia.leiInfrigida,
            data.ocorrencia.artigo,
            data.itemApreendido.especie,
            data.itemApreendido.item,
            data.itemApreendido.quantidade,
            data.itemApreendido.unidadeMedida || '',
            data.itemApreendido.descricao,
            data.proprietario.nome,
            isoToBrDate(data.proprietario.dataNascimento),
            data.proprietario.tipoDocumento,
            data.proprietario.numeroDocumento,
            data.policial.nome,
            data.policial.matricula,
            data.policial.graduacao,
            data.policial.unidade,
            data.metadata.registradoPor
          ]
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
      message: 'Ocorrência registrada com sucesso!',
      jsonPath: jsonFilepath
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

// IPC Handler para carregar dashboard
ipcMain.on('load-dashboard', () => {
  mainWindow.loadFile(path.join(__dirname, 'views/dashboard.html'));
});

// IPC Handler para obter todas as ocorrências do Google Sheets
ipcMain.handle('get-occurrences', async (event) => {
  try {
    const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxY_nB8LrroSxy6KHSb1Jxkm4otWeK0rSjP6OGtGIk63WPcDbXbSv5C9gsCknAEIZRm/exec";

    if (!GOOGLE_SHEETS_URL) {
      console.log('Google Sheets URL não configurada, retornando dados locais');
      return { success: true, data: [] };
    }

    const https = require('https');
    const url = require('url');

    // Função recursiva para seguir redirecionamentos
    const followRedirects = (targetUrl, maxRedirects = 5) => {
      return new Promise((resolve, reject) => {
        if (maxRedirects === 0) {
          reject(new Error('Muitos redirecionamentos'));
          return;
        }

        https.get(targetUrl, (res) => {
          // Seguir redirecionamentos
          if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 307 || res.statusCode === 308) {
            const redirectUrl = res.headers.location;
            console.log(`Redirecionando para: ${redirectUrl}`);
            followRedirects(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
            return;
          }

          let responseData = '';
          res.on('data', (chunk) => { responseData += chunk; });
          res.on('end', () => {
            resolve(responseData);
          });
        }).on('error', (error) => {
          reject(error);
        });
      });
    };

    return new Promise((resolve, reject) => {
      followRedirects(GOOGLE_SHEETS_URL)
        .then(responseData => {
          try {
            console.log('Resposta do Google Sheets (primeiros 500 caracteres):', responseData.substring(0, 500));
            const data = JSON.parse(responseData);
            console.log('Dados parseados com sucesso. Total de ocorrências:', data.occurrences?.length || 0);
            resolve({ success: true, data: data.occurrences || [] });
          } catch (err) {
            console.error('Erro ao parsear resposta:', err);
            console.error('Resposta recebida:', responseData.substring(0, 200));
            resolve({ success: true, data: [] });
          }
        })
        .catch(error => {
          console.error('Erro ao carregar do Google Sheets:', error);
          resolve({ success: true, data: [] });
        });
    });
  } catch (error) {
    console.error('Erro ao obter ocorrências:', error);
    return { success: false, message: error.message, data: [] };
  }
});

// IPC Handler para atualizar ocorrência (APENAS Google Sheets)
ipcMain.handle('update-occurrence', async (event, data) => {
  try {
    const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxY_nB8LrroSxy6KHSb1Jxkm4otWeK0rSjP6OGtGIk63WPcDbXbSv5C9gsCknAEIZRm/exec";

    if (!GOOGLE_SHEETS_URL) {
      return { success: false, message: 'Google Sheets URL não configurada' };
    }

    const https = require('https');
    const url = require('url');

    // Usar numeroGenesisOriginal para identificar a linha, se fornecido
    const numeroGenesisParaBusca = data.numeroGenesisOriginal || data.ocorrencia.numeroGenesis;

    const updateData = {
      action: 'update',
      timestamp: new Date().toLocaleString('pt-BR'),
      numeroGenesisOriginal: numeroGenesisParaBusca, // Para identificar a linha
      numeroGenesis: data.ocorrencia.numeroGenesis, // Novo valor (pode ser igual ao original)
      unidade: data.ocorrencia.unidade,
      dataApreensao: isoToBrDate(data.ocorrencia.dataApreensao),
      leiInfrigida: data.ocorrencia.leiInfrigida,
      artigo: data.ocorrencia.artigo,
      especie: data.itemApreendido.especie,
      item: data.itemApreendido.item,
      quantidade: data.itemApreendido.quantidade,
      unidadeMedida: data.itemApreendido.unidadeMedida || '',
      descricaoItem: data.itemApreendido.descricao,
      nomeProprietario: data.proprietario.nome,
      dataNascimento: isoToBrDate(data.proprietario.dataNascimento),
      tipoDocumento: data.proprietario.tipoDocumento,
      numeroDocumento: data.proprietario.numeroDocumento,
      nomePolicial: data.policial.nome,
      matricula: data.policial.matricula,
      graduacao: data.policial.graduacao,
      unidadePolicial: data.policial.unidade,
      registradoPor: data.metadata.registradoPor
    };

    console.log('Enviando atualização para Google Sheets:', updateData);
    console.log('Número Genesis para busca:', numeroGenesisParaBusca);
    console.log('Número Genesis novo:', data.ocorrencia.numeroGenesis);

    const postData = JSON.stringify(updateData);

    // Função recursiva para seguir redirecionamentos em POST
    const postWithRedirects = (targetUrl, payload, maxRedirects = 5) => {
      return new Promise((resolve, reject) => {
        if (maxRedirects === 0) {
          reject(new Error('Muitos redirecionamentos'));
          return;
        }

        const parsedUrl = url.parse(targetUrl);
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const req = https.request(options, (res) => {
          // Seguir redirecionamentos
          if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 307 || res.statusCode === 308) {
            const redirectUrl = res.headers.location;
            console.log(`Redirecionando POST para: ${redirectUrl}`);

            // Para redirecionamentos 307 e 308, manter POST
            // Para 301 e 302, usar GET
            if (res.statusCode === 307 || res.statusCode === 308) {
              postWithRedirects(redirectUrl, payload, maxRedirects - 1).then(resolve).catch(reject);
            } else {
              // Converter para GET
              https.get(redirectUrl, (getRes) => {
                let responseData = '';
                getRes.on('data', (chunk) => { responseData += chunk; });
                getRes.on('end', () => {
                  resolve(responseData);
                });
              }).on('error', reject);
            }
            return;
          }

          let responseData = '';
          res.on('data', (chunk) => { responseData += chunk; });
          res.on('end', () => {
            resolve(responseData);
          });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    };

    return new Promise((resolve, reject) => {
      postWithRedirects(GOOGLE_SHEETS_URL, postData)
        .then(responseData => {
          console.log('✓ Resposta do Google Sheets:', responseData);
          try {
            const result = JSON.parse(responseData);
            if (result.success) {
              resolve({ success: true, message: 'Ocorrência atualizada com sucesso' });
            } else {
              resolve({ success: false, message: result.message || 'Erro ao atualizar' });
            }
          } catch (err) {
            // Se não for JSON, considerar sucesso se não houver erro
            resolve({ success: true, message: 'Ocorrência atualizada com sucesso' });
          }
        })
        .catch(error => {
          console.error('Erro ao atualizar no Google Sheets:', error);
          reject({ success: false, message: 'Erro ao atualizar: ' + error.message });
        });
    });

  } catch (error) {
    console.error('Erro ao atualizar ocorrência:', error);
    return { success: false, message: error.message };
  }
});

// IPC Handler para excluir ocorrência (APENAS Google Sheets)
ipcMain.handle('delete-occurrence', async (event, numeroGenesis) => {
  try {
    const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxY_nB8LrroSxy6KHSb1Jxkm4otWeK0rSjP6OGtGIk63WPcDbXbSv5C9gsCknAEIZRm/exec";

    if (!GOOGLE_SHEETS_URL) {
      return { success: false, message: 'Google Sheets URL não configurada' };
    }

    if (!numeroGenesis) {
      return { success: false, message: 'Número Genesis não fornecido' };
    }

    const https = require('https');
    const url = require('url');

    const deleteData = {
      action: 'delete',
      numeroGenesis: numeroGenesis
    };

    console.log('Enviando exclusão para Google Sheets:', deleteData);

    const postData = JSON.stringify(deleteData);

    // Função recursiva para seguir redirecionamentos em POST
    const postWithRedirects = (targetUrl, payload, maxRedirects = 5) => {
      return new Promise((resolve, reject) => {
        if (maxRedirects === 0) {
          reject(new Error('Muitos redirecionamentos'));
          return;
        }

        const parsedUrl = url.parse(targetUrl);
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const req = https.request(options, (res) => {
          // Seguir redirecionamentos
          if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 307 || res.statusCode === 308) {
            const redirectUrl = res.headers.location;
            console.log(`Redirecionando DELETE para: ${redirectUrl}`);

            // Para redirecionamentos 307 e 308, manter POST
            // Para 301 e 302, usar GET
            if (res.statusCode === 307 || res.statusCode === 308) {
              postWithRedirects(redirectUrl, payload, maxRedirects - 1).then(resolve).catch(reject);
            } else {
              // Converter para GET
              https.get(redirectUrl, (getRes) => {
                let responseData = '';
                getRes.on('data', (chunk) => { responseData += chunk; });
                getRes.on('end', () => {
                  resolve(responseData);
                });
              }).on('error', reject);
            }
            return;
          }

          let responseData = '';
          res.on('data', (chunk) => { responseData += chunk; });
          res.on('end', () => {
            resolve(responseData);
          });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    };

    return new Promise((resolve, reject) => {
      postWithRedirects(GOOGLE_SHEETS_URL, postData)
        .then(responseData => {
          console.log('✓ Resposta do Google Sheets (delete):', responseData);
          try {
            const result = JSON.parse(responseData);
            if (result.success) {
              resolve({ success: true, message: 'Ocorrência excluída com sucesso' });
            } else {
              resolve({ success: false, message: result.message || 'Erro ao excluir' });
            }
          } catch (err) {
            // Se não for JSON, considerar sucesso se não houver erro
            resolve({ success: true, message: 'Ocorrência excluída com sucesso' });
          }
        })
        .catch(error => {
          console.error('Erro ao deletar no Google Sheets:', error);
          reject({ success: false, message: 'Erro ao excluir: ' + error.message });
        });
    });

  } catch (error) {
    console.error('Erro ao excluir ocorrência:', error);
    return { success: false, message: error.message };
  }
});

// IPC Handler para exportar todas as ocorrências para Excel
ipcMain.handle('export-occurrences', async (event) => {
  try {
    // Ler JSONs da pasta de ocorrências
    if (!fs.existsSync(FOLDERS.ocorrencias)) {
      return { success: false, message: 'Nenhuma ocorrência encontrada' };
    }

    const files = fs.readdirSync(FOLDERS.ocorrencias).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
      return { success: false, message: 'Nenhuma ocorrência encontrada' };
    }

    // Preparar dados para exportação (ordem do formulário)
    const worksheetData = [
      [
        'Log Registro',
        'Nº Genesis',
        'Unidade',
        'Data Apreensão',
        'Lei Infringida',
        'Artigo',
        'Espécie',
        'Item',
        'Quantidade',
        'Unidade de Medida',
        'Descrição',
        'Nome Proprietário',
        'Data Nascimento',
        'Tipo Documento',
        'Nº Documento',
        'Nome Policial',
        'Matrícula',
        'Graduação',
        'Unidade Policial',
        'Registrado Por'
      ]
    ];

    files.forEach(file => {
      try {
        const filePath = path.join(FOLDERS.ocorrencias, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);

        worksheetData.push([
          new Date(data.metadata.dataRegistro).toLocaleString('pt-BR'),
          data.ocorrencia.numeroGenesis,
          data.ocorrencia.unidade,
          isoToBrDate(data.ocorrencia.dataApreensao),
          data.ocorrencia.leiInfrigida,
          data.ocorrencia.artigo,
          data.itemApreendido.especie,
          data.itemApreendido.item,
          data.itemApreendido.quantidade,
          data.itemApreendido.unidadeMedida || '',
          data.itemApreendido.descricao || '',
          data.proprietario.nome,
          isoToBrDate(data.proprietario.dataNascimento),
          data.proprietario.tipoDocumento,
          data.proprietario.numeroDocumento,
          data.policial.nome,
          data.policial.matricula,
          data.policial.graduacao,
          data.policial.unidade,
          data.metadata.registradoPor
        ]);
      } catch (err) {
        console.error('Erro ao processar arquivo:', file, err);
      }
    });

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Ajustar largura das colunas
    const columnWidths = worksheetData[0].map(() => ({ wch: 20 }));
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Todas Ocorrências');

    // Salvar arquivo em C:\SECRIMPO\Exportacao
    const dateStr = formatDateForFilename();
    const exportFilename = `[EXPORTACAO][${dateStr}].xlsx`;
    const exportPath = path.join(FOLDERS.exportacoes, exportFilename);

    XLSX.writeFile(workbook, exportPath);
    console.log('✓ Exportação salva em:', exportPath);

    return {
      success: true,
      message: 'Exportação concluída com sucesso',
      filePath: exportPath
    };
  } catch (error) {
    console.error('Erro ao exportar ocorrências:', error);
    return { success: false, message: error.message };
  }
});

// IPC Handler para gerar e visualizar Termo de Apreensão
ipcMain.handle('print-termo-apreensao', async (event, occurrenceData) => {
  try {
    const fs = require('fs');
    const os = require('os');

    // Criar janela temporária para gerar o PDF
    const tempWindow = new BrowserWindow({
      width: 800,
      height: 1000,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Carregar o template do termo de apreensão
    const templatePath = path.join(__dirname, 'templates/termo_apreensao.html');
    await tempWindow.loadFile(templatePath);

    // Injetar os dados da ocorrência no template
    await tempWindow.webContents.executeJavaScript(`
      window.occurrenceData = ${JSON.stringify(occurrenceData)};
      if (typeof populateForm === 'function') {
        populateForm(window.occurrenceData);
      }
    `);

    // Aguardar para garantir que os dados foram preenchidos
    await new Promise(resolve => setTimeout(resolve, 800));

    // Gerar PDF em C:\SECRIMPO\Termos
    const dateStr = formatDateForFilename();
    const numeroGenesis = occurrenceData.ocorrencia.numeroGenesis;
    const pdfFilename = `[${numeroGenesis}][${dateStr}].pdf`;
    const pdfPath = path.join(FOLDERS.termos, pdfFilename);

    const pdfData = await tempWindow.webContents.printToPDF({
      printBackground: true,
      margins: {
        marginType: 'none'
      },
      pageSize: 'A4',
      landscape: false,
      preferCSSPageSize: true
    });

    fs.writeFileSync(pdfPath, pdfData);
    console.log('PDF gerado:', pdfPath);

    // Fechar janela temporária
    tempWindow.close();

    // Criar janela de prévia do PDF
    const previewWindow = new BrowserWindow({
      width: 900,
      height: 1000,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        plugins: true
      },
      autoHideMenuBar: true,
      title: 'Termo de Apreensão - Prévia'
    });

    // Remover menu
    previewWindow.setMenu(null);

    // Carregar PDF diretamente
    console.log('Carregando PDF na janela:', pdfPath);
    await previewWindow.loadFile(pdfPath);

    // Adicionar botões de ação via JavaScript injetado
    await previewWindow.webContents.executeJavaScript(`
      // Criar toolbar com botões
      const toolbar = document.createElement('div');
      toolbar.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #071d49 0%, #0a2d6e 100%); color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 10000; font-family: system-ui, -apple-system, sans-serif;';
      
      const title = document.createElement('div');
      title.textContent = 'Termo de Apreensão';
      title.style.cssText = 'font-size: 16px; font-weight: normal;';
      
      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 10px;';
      
      const btnPrint = document.createElement('button');
      btnPrint.textContent = 'Imprimir';
      btnPrint.style.cssText = 'padding: 10px 20px; background: linear-gradient(135deg, #279b4d 0%, #1f8040 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: normal; cursor: pointer; font-family: inherit;';
      btnPrint.onclick = () => window.print();
      
      const btnClose = document.createElement('button');
      btnClose.textContent = 'Fechar';
      btnClose.style.cssText = 'padding: 10px 20px; background: #e0e0e0; color: #333; border: none; border-radius: 8px; font-size: 14px; font-weight: normal; cursor: pointer; font-family: inherit;';
      btnClose.onclick = () => window.close();
      
      actions.appendChild(btnPrint);
      actions.appendChild(btnClose);
      toolbar.appendChild(title);
      toolbar.appendChild(actions);
      document.body.insertBefore(toolbar, document.body.firstChild);
      
      // Ajustar margem do corpo para não sobrepor a toolbar
      document.body.style.marginTop = '60px';
    `);

    previewWindow.show();

    return { success: true, message: 'Prévia do documento gerada', pdfPath: pdfPath };
  } catch (error) {
    console.error('Erro ao gerar termo de apreensão:', error);
    return { success: false, message: error.message };
  }
});

// IPC Handler para imprimir PDF
ipcMain.handle('print-pdf', async (event, pdfPath) => {
  try {
    const fs = require('fs');

    if (!fs.existsSync(pdfPath)) {
      return { success: false, message: 'Arquivo PDF não encontrado' };
    }

    // Criar janela para impressão
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Carregar o PDF
    await printWindow.loadFile(pdfPath);

    // Aguardar carregamento
    await new Promise(resolve => setTimeout(resolve, 500));

    // Abrir diálogo de impressão
    printWindow.webContents.print({
      silent: false,
      printBackground: true
    }, (success, errorType) => {
      if (!success) {
        console.error('Erro ao imprimir:', errorType);
      }
      printWindow.close();
    });

    return { success: true, message: 'Documento enviado para impressão' };
  } catch (error) {
    console.error('Erro ao imprimir PDF:', error);
    return { success: false, message: error.message };
  }
});

// IPC Handler para extrair dados de arquivo
ipcMain.handle('extract-file-data', async (event, filePath) => {
  try {
    console.log('=== INICIANDO EXTRAÇÃO DE ARQUIVO ===');
    console.log('Arquivo:', filePath);

    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error('Arquivo não encontrado: ' + filePath);
    }

    const fileExtractor = require('./scripts/fileExtractor');
    console.log('Módulo fileExtractor carregado com sucesso');

    // Extrair texto do arquivo
    console.log('Iniciando extração de texto...');
    const text = await fileExtractor.extractTextFromFile(filePath);
    console.log('Texto extraído com sucesso!');
    console.log('Tamanho do texto:', text.length, 'caracteres');
    console.log('Primeiros 500 caracteres:', text.substring(0, 500));

    // Extrair campos específicos do texto
    console.log('Extraindo campos específicos...');
    const extractedFields = fileExtractor.extractFieldsFromText(text);
    console.log('Campos extraídos:', JSON.stringify(extractedFields, null, 2));

    // Mapear para o formato do formulário
    console.log('Mapeando dados para o formulário...');
    const formData = fileExtractor.mapFieldsToForm(extractedFields);
    console.log('Dados mapeados:', JSON.stringify(formData, null, 2));

    console.log('=== EXTRAÇÃO CONCLUÍDA COM SUCESSO ===');

    return {
      success: true,
      data: formData,
      message: 'Dados extraídos com sucesso'
    };
  } catch (error) {
    console.error('=== ERRO NA EXTRAÇÃO ===');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    return {
      success: false,
      message: error.message || 'Erro ao processar arquivo'
    };
  }
});

// IPC Handler para obter contagem de usuários ativos do KeyAuth
ipcMain.handle('get-active-users-count', async (event) => {
  return new Promise((resolve, reject) => {
    const isDev = !app.isPackaged;

    let pythonCommand;
    let pythonArgs;

    if (isDev) {
      // Desenvolvimento: usar Python script diretamente
      const pythonScript = path.join(__dirname, '../auth/get_online_users.py');
      pythonCommand = 'python';
      pythonArgs = [pythonScript];
    } else {
      // Produção: usar executável compilado (se existir)
      const exePath = path.join(process.resourcesPath, 'auth/get_online_users.exe');

      if (fs.existsSync(exePath)) {
        pythonCommand = exePath;
        pythonArgs = [];
      } else {
        // Fallback: tentar Python script
        const pythonScript = path.join(__dirname, '../auth/get_online_users.py');
        pythonCommand = 'python';
        pythonArgs = [pythonScript];
      }
    }

    const pythonProcess = spawn(pythonCommand, pythonArgs);

    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    pythonProcess.on('close', (code) => {
      try {
        // Extrair JSON da saída
        const lines = dataString.trim().split('\n');
        let jsonString = '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('{')) {
            jsonString = trimmedLine;
            break;
          }
        }

        if (jsonString) {
          const result = JSON.parse(jsonString);
          if (result.success) {
            resolve(result.count);
          } else {
            console.error('Erro ao buscar usuários online:', result.error);
            resolve(1); // Fallback: 1 usuário
          }
        } else {
          console.error('Nenhum JSON encontrado na resposta');
          resolve(1); // Fallback: 1 usuário
        }
      } catch (e) {
        console.error('Erro ao parsear resposta de usuários online:', e);
        resolve(1); // Fallback: 1 usuário
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Erro ao executar script de usuários online:', error);
      resolve(1); // Fallback: 1 usuário
    });
  });
});
