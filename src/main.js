const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const XLSX = require('xlsx');

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
        'Log Registro',
        'Nº Genesis',
        'Unidade',
        'Data Apreensão',
        'Lei Infringida',
        'Artigo',
        'Policial Condutor',
        'Espécie',
        'Item',
        'Quantidade',
        'Unidade de Medida',
        'Peso',
        'Descrição',
        'Ocorrência Item',
        'Proprietário Item',
        'Policial Item',
        'Valor Item',
        'Número de Série',
        'Nome Policial',
        'Nome Completo',
        'Data Nascimento',
        'Documento',
        'Nº Documento',
        'Nome Completo',
        'Matrícula',
        'Graduação',
        'Unidade',
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
        data.itemApreendido.unidadeMedida || '',
        data.itemApreendido.peso || '',
        data.itemApreendido.descricao,
        data.itemApreendido.ocorrencia || '',
        data.itemApreendido.proprietario || '',
        data.itemApreendido.policial || '',
        data.itemApreendido.valor || '',
        data.itemApreendido.numeroSerie || '',
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
    const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxARGfB0PYy4ldli1GTzFnwTLn8P9Je9UTVvbiAcVOeVeqgfnEixcJIFEgmPnau-aMs/exec"; // Cole sua URL do Google Apps Script aqui

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
            data.ocorrencia.dataApreensao,
            data.ocorrencia.leiInfrigida,
            data.ocorrencia.artigo,
            data.ocorrencia.policialCondutor,
            data.itemApreendido.especie,
            data.itemApreendido.item,
            data.itemApreendido.quantidade,
            data.itemApreendido.unidadeMedida || '',
            data.itemApreendido.peso || '',
            data.itemApreendido.descricao,
            data.itemApreendido.ocorrencia || '',
            data.itemApreendido.proprietario || '',
            data.itemApreendido.policial || '',
            data.itemApreendido.valor || '',
            data.itemApreendido.numeroSerie || '',
            data.policial.nome,
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

// IPC Handler para carregar dashboard
ipcMain.on('load-dashboard', () => {
  mainWindow.loadFile(path.join(__dirname, 'views/dashboard.html'));
});

// IPC Handler para obter todas as ocorrências do Google Sheets
ipcMain.handle('get-occurrences', async (event) => {
  try {
    const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxARGfB0PYy4ldli1GTzFnwTLn8P9Je9UTVvbiAcVOeVeqgfnEixcJIFEgmPnau-aMs/exec";

    if (!GOOGLE_SHEETS_URL) {
      console.log('Google Sheets URL não configurada, retornando dados locais');
      return { success: true, data: [] };
    }

    const https = require('https');
    const url = require('url');

    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(GOOGLE_SHEETS_URL);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      https.get(GOOGLE_SHEETS_URL, (res) => {
        // Seguir redirecionamentos
        if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 307) {
          const redirectUrl = res.headers.location;
          https.get(redirectUrl, (redirectRes) => {
            let responseData = '';
            redirectRes.on('data', (chunk) => { responseData += chunk; });
            redirectRes.on('end', () => {
              try {
                const data = JSON.parse(responseData);
                resolve({ success: true, data: data.occurrences || [] });
              } catch (err) {
                console.error('Erro ao parsear resposta:', err);
                resolve({ success: true, data: [] });
              }
            });
          }).on('error', (error) => {
            console.error('Erro no redirect:', error);
            resolve({ success: true, data: [] });
          });
          return;
        }

        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(responseData);
            resolve({ success: true, data: data.occurrences || [] });
          } catch (err) {
            console.error('Erro ao parsear resposta:', err);
            resolve({ success: true, data: [] });
          }
        });
      }).on('error', (error) => {
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
    const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxARGfB0PYy4ldli1GTzFnwTLn8P9Je9UTVvbiAcVOeVeqgfnEixcJIFEgmPnau-aMs/exec";

    if (!GOOGLE_SHEETS_URL) {
      return { success: false, message: 'Google Sheets URL não configurada' };
    }

    const https = require('https');
    const url = require('url');

    const updateData = {
      action: 'update',
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
      unidadeMedida: data.itemApreendido.unidadeMedida || '',
      peso: data.itemApreendido.peso || '',
      descricaoItem: data.itemApreendido.descricao,
      ocorrenciaItem: data.itemApreendido.ocorrencia || '',
      proprietarioItem: data.itemApreendido.proprietario || '',
      policialItem: data.itemApreendido.policial || '',
      valorItem: data.itemApreendido.valor || '',
      numeroSerie: data.itemApreendido.numeroSerie || '',
      nomePolicial: data.policial.nome,
      nomeProprietario: data.proprietario.nome,
      dataNascimento: data.proprietario.dataNascimento,
      tipoDocumento: data.proprietario.tipoDocumento,
      numeroDocumento: data.proprietario.numeroDocumento,
      matricula: data.policial.matricula,
      graduacao: data.policial.graduacao,
      unidadePolicial: data.policial.unidade,
      registradoPor: data.metadata.registradoPor
    };

    const postData = JSON.stringify(updateData);
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

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        // Seguir redirecionamentos
        if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 307) {
          const redirectUrl = res.headers.location;
          console.log('Seguindo redirecionamento para atualizar no Google Sheets...');

          https.get(redirectUrl, (redirectRes) => {
            let responseData = '';
            redirectRes.on('data', (chunk) => { responseData += chunk; });
            redirectRes.on('end', () => {
              console.log('✓ Ocorrência atualizada no Google Sheets:', responseData);
              resolve({ success: true, message: 'Ocorrência atualizada com sucesso' });
            });
          }).on('error', (error) => {
            console.error('Erro no redirect para Google Sheets:', error);
            reject({ success: false, message: 'Erro ao atualizar: ' + error.message });
          });

          return;
        }

        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          console.log('✓ Ocorrência atualizada no Google Sheets:', responseData);
          resolve({ success: true, message: 'Ocorrência atualizada com sucesso' });
        });
      });

      req.on('error', (error) => {
        console.error('Erro ao atualizar no Google Sheets:', error);
        reject({ success: false, message: 'Erro ao atualizar: ' + error.message });
      });

      req.write(postData);
      req.end();
    });

  } catch (error) {
    console.error('Erro ao atualizar ocorrência:', error);
    return { success: false, message: error.message };
  }
});

// IPC Handler para excluir ocorrência (APENAS Google Sheets)
ipcMain.handle('delete-occurrence', async (event, numeroGenesis) => {
  try {
    const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxARGfB0PYy4ldli1GTzFnwTLn8P9Je9UTVvbiAcVOeVeqgfnEixcJIFEgmPnau-aMs/exec";

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

    const postData = JSON.stringify(deleteData);
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

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        // Seguir redirecionamentos
        if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 307) {
          const redirectUrl = res.headers.location;
          console.log('Seguindo redirecionamento para deletar no Google Sheets...');

          https.get(redirectUrl, (redirectRes) => {
            let responseData = '';
            redirectRes.on('data', (chunk) => { responseData += chunk; });
            redirectRes.on('end', () => {
              console.log('✓ Ocorrência deletada do Google Sheets:', responseData);
              resolve({ success: true, message: 'Ocorrência excluída com sucesso' });
            });
          }).on('error', (error) => {
            console.error('Erro no redirect para Google Sheets:', error);
            reject({ success: false, message: 'Erro ao excluir: ' + error.message });
          });

          return;
        }

        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          console.log('✓ Ocorrência deletada do Google Sheets:', responseData);
          resolve({ success: true, message: 'Ocorrência excluída com sucesso' });
        });
      });

      req.on('error', (error) => {
        console.error('Erro ao deletar no Google Sheets:', error);
        reject({ success: false, message: 'Erro ao excluir: ' + error.message });
      });

      req.write(postData);
      req.end();
    });

  } catch (error) {
    console.error('Erro ao excluir ocorrência:', error);
    return { success: false, message: error.message };
  }
});

// IPC Handler para exportar todas as ocorrências para Excel
ipcMain.handle('export-occurrences', async (event) => {
  try {
    const fs = require('fs');
    const os = require('os');

    const dataDir = path.join(os.tmpdir(), 'secrimpo-pmdf-data');

    if (!fs.existsSync(dataDir)) {
      return { success: false, message: 'Nenhuma ocorrência encontrada' };
    }

    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
      return { success: false, message: 'Nenhuma ocorrência encontrada' };
    }

    // Preparar dados para exportação
    const worksheetData = [
      [
        'Log Registro',
        'Nº Genesis',
        'Unidade',
        'Data Apreensão',
        'Lei Infringida',
        'Artigo',
        'Policial Condutor',
        'Espécie',
        'Item',
        'Quantidade',
        'Unidade de Medida',
        'Peso',
        'Descrição Item',
        'Ocorrência Item',
        'Proprietário Item',
        'Policial Item',
        'Valor Item',
        'Número de Série',
        'Nome Proprietário',
        'Data Nascimento',
        'Tipo Documento',
        'Nº Documento',
        'Nome Policial',
        'Matrícula',
        'Graduação',
        'Unidade Policial',
        'Registrado Por',
        'Data Registro'
      ]
    ];

    files.forEach(file => {
      try {
        const filePath = path.join(dataDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);

        worksheetData.push([
          new Date(data.metadata.dataRegistro).toLocaleString('pt-BR'),
          data.ocorrencia.numeroGenesis,
          data.ocorrencia.unidade,
          data.ocorrencia.dataApreensao,
          data.ocorrencia.leiInfrigida,
          data.ocorrencia.artigo,
          data.ocorrencia.policialCondutor,
          data.itemApreendido.especie,
          data.itemApreendido.item,
          data.itemApreendido.quantidade,
          data.itemApreendido.unidadeMedida || '',
          data.itemApreendido.peso || '',
          data.itemApreendido.descricao || '',
          data.itemApreendido.ocorrencia || '',
          data.itemApreendido.proprietario || '',
          data.itemApreendido.policial || '',
          data.itemApreendido.valor || '',
          data.itemApreendido.numeroSerie || '',
          data.proprietario.nome,
          data.proprietario.dataNascimento,
          data.proprietario.tipoDocumento,
          data.proprietario.numeroDocumento,
          data.policial.nome,
          data.policial.matricula,
          data.policial.graduacao,
          data.policial.unidade,
          data.metadata.registradoPor,
          new Date(data.metadata.dataRegistro).toLocaleString('pt-BR')
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

    // Salvar arquivo
    const timestamp = new Date().getTime();
    const exportFilename = `todas_ocorrencias_${timestamp}.xlsx`;
    const exportPath = path.join(dataDir, exportFilename);

    XLSX.writeFile(workbook, exportPath);

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
