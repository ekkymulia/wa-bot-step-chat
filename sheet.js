const workbook = SpreadsheetApp.getActiveSpreadsheet();

const CABANG = {
  'gedongtataan': 'GEDONG TATAAN',
  'gadingrejo': 'GADINGREJO',
  'pringsewu': 'PRINGSEWU'
}


function doGet() {
  const sheets = workbook.getSheetByName('GEDONG TATAAN');

  var cell = sheets.getRange('C9');
  var rule = cell.getDataValidation();
  let response = {};

  if (rule != null) {
    var criteria = rule.getCriteriaType();
    var args = rule.getCriteriaValues();
    response = {
      success: args[1],
      data: args[0],
    }
  } else {
    response = {
      success: false,
      data: [],
    }
  }

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(param){
  if(!param){
    return 
  }

  const data = param.parameters

  // const data = {
  //   retur: [ '' ],
  //   tanggal: [ '03 juni 2023' ],
  //   cabang: [ 'gedongtataan' ],
  //   barangTerjual: [ '9' ],
  //   keterangan: [ 'harian fahman,50.000,harian fitri,25.000,harian bg riski,120.000,operasional ekspedisi,285.000' ],
  //   barangMasuk: [ '13' ]
  // }
  
  const tanggal = data.tanggal[0];
  const cabang = data.cabang[0];
  const barangTerjual = data.barangTerjual[0];
  const retur = data.retur[0];
  const barangMasuk = data.barangMasuk[0];
  let keterangan = data.keterangan[0];
  keterangan = keterangan.split(",").map(item => item.trim());

  let result = [];
  for (let i = 0; i < keterangan.length; i += 2) {
    let name = keterangan[i].replace(/'/g, '');
    let amount = parseInt(keterangan[i + 1].replace(/'/g, '').replace(/\./g, ''));
    result.push([name, amount]);
  }

  keterangan = result;

  const dataCategory = JSON.parse(doGet().getContent()).data
  const additionalCategory = {
    'harian': 'Gaji',
    'transfer': 'Kas',
    // bisa ditambah untuk kategori otomatis
  }

  keterangan = keterangan.map(([key, value]) => {
    const words = key.split(' ');
    let type = words.length > 1 ? words.shift() : words[0];
    const validValues = {
      harian: 'Harian',
      transfer: 'Transfer',
      // bisa di tambah lagi kata kata lain disini
    };

    let data = type.toLowerCase();
    if (validValues.hasOwnProperty(data)) {
      data = validValues[data] + ' ' + words.join(' ');
    } else {
      data = words.join(' ');
    }


    type = additionalCategory[type] ? additionalCategory[type] : (dataCategory.find(item => item.toLowerCase() === type) ? dataCategory.find(item => item.toLowerCase() === type) : 'Tidak Diketahui');
    return {
      type,
      data,
      amount: value
    };
  });

  console.log(keterangan)

  const insrtt = insertToSheet(cabang, {tanggal, cabang, barangTerjual, retur, barangMasuk, keterangan});
  
  let response = {
    success: insrtt,
    data: [],
  }

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function insertToSheet(sheet_name, data) {
  const sheet2 = workbook.getSheetByName(CABANG[sheet_name]);
  const rlen = sheet2.getLastRow();
  const clen = sheet2.getLastColumn();
  const rows = sheet2.getRange(1, 1, rlen, clen).getValues();

  const dateStr = data.tanggal;
  const dateObj = new Date(dateStr);

  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();
  
  data.tanggal = `${month}-${day}-${year}`;

  let no = 0;
  let no_take = false;
  for (let a = 9; a < rows.length; a++) {
    const dataRow2 = rows[a];
    if (dataRow2[0] != '') {
      no = dataRow2[0];
    }
    const urutan = ['barangTerjual', 'retur', 'barangMasuk'];
    let urutan_num = 0;
    let ket_urutan_num = 0;

    if (dataRow2[2] === '') {
      const formulas4 = sheet2.getRange(a + 1, 5, 1, 1).getFormulaR1C1(); // Store formula in column E (index 4)
      const formulas8 = sheet2.getRange(a + 1, 9, 1, 1).getFormulaR1C1(); // Store formula in column I (index 8)

      for (let b = a; b < rows.length; b++) {
        console.log(b)
        if (no_take == false) {
          dataRow2[0] = no + 1;
          dataRow2[1] = data.tanggal;
          no_take = true;
        } else {
          dataRow2[0] = '';
          dataRow2[1] = '';
        }

        if(data[urutan[0]] == '' &&  data[urutan[1]] != ''  &&  data[urutan[2]] == ''  && urutan_num === 0){
            dataRow2[5] =  ''
            dataRow2[6] = data[urutan[1]];
            dataRow2[7] =  ''
            dataRow2[2] = 'Penjualan' 
            urutan_num = 1

            sheet2.getRange(b + 1, 1, 1, 15).setValues([dataRow2]);
            sheet2.getRange(b + 1, 5).setFormula(`=I${b}`);
            sheet2.getRange(b + 1, 9).setFormula(`=E${b + 1}-F${b + 1}-G${b + 1}+H${b + 1}`);
            sheet2.getRange(b + 1, 10).setFormula(`=35000*F${b + 1}`);
            sheet2.getRange(b + 1, 15).setFormula(`=O${b}+J${b + 1}-M${b + 1}`);

            continue
        } else if(data[urutan[0]] != '' &&  data[urutan[1]] == ''  &&  data[urutan[2]] == ''  && urutan_num === 0){
            dataRow2[5] =data[urutan[0]]
            dataRow2[6] = '';
            dataRow2[7] =  ''
            dataRow2[2] = 'Penjualan' 
            urutan_num = 1

            sheet2.getRange(b + 1, 1, 1, 15).setValues([dataRow2]);
            sheet2.getRange(b + 1, 5).setFormula(`=I${b}`);
            sheet2.getRange(b + 1, 9).setFormula(`=E${b + 1}-F${b + 1}-G${b + 1}+H${b + 1}`);
            sheet2.getRange(b + 1, 10).setFormula(`=35000*F${b + 1}`);
            sheet2.getRange(b + 1, 15).setFormula(`=O${b}+J${b + 1}-M${b + 1}`);

            continue
        } else if(data[urutan[0]] != '' &&  data[urutan[1]] != ''  &&  data[urutan[2]] == ''  && urutan_num === 0){
            dataRow2[5] =  data[urutan[0]]
            dataRow2[6] = data[urutan[1]];
            dataRow2[7] =  ''
            dataRow2[2] = 'Penjualan' 
            urutan_num = 1

            sheet2.getRange(b + 1, 1, 1, 15).setValues([dataRow2]);
            sheet2.getRange(b + 1, 5).setFormula(`=I${b}`);
            sheet2.getRange(b + 1, 9).setFormula(`=E${b + 1}-F${b + 1}-G${b + 1}+H${b + 1}`);
            sheet2.getRange(b + 1, 10).setFormula(`=35000*F${b + 1}`);
            sheet2.getRange(b + 1, 15).setFormula(`=O${b}+J${b + 1}-M${b + 1}`);

            continue
        } else if(urutan_num === 0){
            dataRow2[5] =  data[urutan[0]]
            dataRow2[6] = data[urutan[1]];
            dataRow2[7] =  ''
            dataRow2[2] = 'Penjualan' 
            urutan_num = 1

            sheet2.getRange(b + 1, 1, 1, 15).setValues([dataRow2]);
            sheet2.getRange(b + 1, 5).setFormula(`=I${b}`);
            sheet2.getRange(b + 1, 9).setFormula(`=E${b + 1}-F${b + 1}-G${b + 1}+H${b + 1}`);
            sheet2.getRange(b + 1, 10).setFormula(`=35000*F${b + 1}`);
            sheet2.getRange(b + 1, 15).setFormula(`=O${b}+J${b + 1}-M${b + 1}`);

            continue
        }
        
        if(data[urutan[2]] != ''  && urutan_num === 1){
            dataRow2[7] =  data[urutan[2]]
            dataRow2[5] = '' 
            dataRow2[6] = ''
            dataRow2[2] = 'Pembelian' 
            urutan_num = 2

            sheet2.getRange(b + 1, 1, 1, 15).setValues([dataRow2]);
            sheet2.getRange(b + 1, 5).setFormula(`=I${b}`);
            sheet2.getRange(b + 1, 9).setFormula(`=E${b + 1}-F${b + 1}-G${b + 1}+H${b + 1}`);
            sheet2.getRange(b + 1, 10).setFormula(`=35000*F${b + 1}`);
            sheet2.getRange(b + 1, 15).setFormula(`=O${b}+J${b + 1}-M${b + 1}`);

            continue
        }else if(data[urutan[2]] == ''  && urutan_num === 1){
          b--
          urutan_num = 2
          continue
        }
        
        if (urutan_num >= 2) {
          dataRow2[2] = data.keterangan[ket_urutan_num].type;
          dataRow2[11] = data.keterangan[ket_urutan_num].data;
          dataRow2[12] = data.keterangan[ket_urutan_num].amount;
          dataRow2[7] =  ''
          dataRow2[5] = '' 
          dataRow2[6] = ''
          console.log(dataRow2);

          ket_urutan_num++;

          if (ket_urutan_num == data.keterangan.length) {
            sheet2.getRange(b + 1, 1, 1, 15).setValues([dataRow2]);
            sheet2.getRange(b + 1, 5).setFormula(`=I${b}`);
            sheet2.getRange(b + 1, 9).setFormula(`=E${b + 1}-F${b + 1}-G${b + 1}+H${b + 1}`);
            sheet2.getRange(b + 1, 10).setFormula(`=35000*F${b + 1}`);
            sheet2.getRange(b + 1, 15).setFormula(`=O${b}+J${b + 1}-M${b + 1}`);
            return true;
          }
        }

        sheet2.getRange(b + 1, 1, 1, 15).setValues([dataRow2]);
        sheet2.getRange(b + 1, 5).setFormula(`=I${b}`);
        sheet2.getRange(b + 1, 9).setFormula(`=E${b + 1}-F${b + 1}-G${b + 1}+H${b + 1}`);
        sheet2.getRange(b + 1, 10).setFormula(`=35000*F${b + 1}`);
        sheet2.getRange(b + 1, 15).setFormula(`=O${b}+J${b + 1}-M${b + 1}`);
        urutan_num++;
      }
    }
  }

  return true;
}