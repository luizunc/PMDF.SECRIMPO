function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Pegar todos os dados a partir da linha 3, coluna A
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 3) {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        occurrences: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 24); // A3 até X (24 colunas a partir da coluna A)
    const values = dataRange.getValues();
    
    const occurrences = values.map(row => ({
      logRegistro: row[0],
      numeroGenesis: row[1],
      unidade: row[2],
      dataApreensao: row[3],
      leiInfrigida: row[4],
      artigo: row[5],
      policialCondutor: row[6],
      especie: row[7],
      item: row[8],
      quantidade: row[9],
      unidadeMedida: row[10],
      descricaoItem: row[11],
      ocorrenciaItem: row[12],
      proprietarioItem: row[13],
      policialItem: row[14],
      nomeProprietario: row[15],
      dataNascimento: row[16],
      tipoDocumento: row[17],
      numeroDocumento: row[18],
      nomePolicial: row[19],
      matricula: row[20],
      graduacao: row[21],
      unidadePolicial: row[22],
      registradoPor: row[23]
    }));
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      occurrences: occurrences
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    // Se for uma ação de atualização
    if (data.action === 'update') {
      const numeroGenesis = data.numeroGenesis;
      const lastRow = sheet.getLastRow();
      
      // Procurar a linha com o número Genesis correspondente (coluna B = índice 2)
      for (let i = 3; i <= lastRow; i++) {
        if (sheet.getRange(i, 2).getValue() == numeroGenesis) {
          // Atualizar a linha encontrada (a partir da coluna A = índice 1)
          sheet.getRange(i, 1, 1, 24).setValues([[
            data.timestamp,
            data.numeroGenesis,
            data.unidade,
            data.dataApreensao,
            data.leiInfrigida,
            data.artigo,
            data.policialCondutor,
            data.especie,
            data.item,
            data.quantidade,
            data.unidadeMedida,
            data.descricaoItem,
            data.ocorrenciaItem,
            data.proprietarioItem,
            data.policialItem,
            data.nomeProprietario,
            data.dataNascimento,
            data.tipoDocumento,
            data.numeroDocumento,
            data.nomePolicial,
            data.matricula,
            data.graduacao,
            data.unidadePolicial,
            data.registradoPor
          ]]);
          
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Ocorrência atualizada com sucesso'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Ocorrência não encontrada'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Se for uma ação de exclusão
    if (data.action === 'delete') {
      const numeroGenesis = data.numeroGenesis;
      const lastRow = sheet.getLastRow();
      
      // Procurar a linha com o número Genesis correspondente (coluna B = índice 2)
      for (let i = 3; i <= lastRow; i++) {
        if (sheet.getRange(i, 2).getValue() == numeroGenesis) {
          // Deletar a linha encontrada
          sheet.deleteRow(i);
          
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Ocorrência excluída com sucesso'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Ocorrência não encontrada'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Inserção normal (adicionar nova linha)
    if (data.values && Array.isArray(data.values)) {
      // Encontrar a próxima linha vazia a partir da linha 3
      const lastRow = sheet.getLastRow();
      const nextRow = Math.max(3, lastRow + 1);
      
      // Inserir dados a partir da coluna A (1ª coluna)
      sheet.getRange(nextRow, 1, 1, data.values.length).setValues([data.values]);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Dados inseridos com sucesso'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Formato de dados inválido'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
