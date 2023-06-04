const { DisconnectReason, useMultiFileAuthState } = require('baileys');
const makeWASocket = require('baileys').default;
const axios = require("axios");

const SHEET_URL = "https://script.google.com/macros/s/AKfycbxXt2sR-PVJL069Uanh3iu2mUT5J80_iNaS1JQ9vkWyyPaSRh7ieGNfkynESY1VZHAd0A/exec"

const startSock = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('connection.update', function(update, connection2) {
        let _a, _b;
        let connection = update.connection,
            lastDisconnect = update.lastDisconnect;

        if (connection == "close") {
            if (((_b = (_a = lastDisconnect.error) === null) || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.statusCode !== DisconnectReason.loggedOut) {
                startSock();
            }
        } else {
            console.log("connection closed");
        }

        console.log("connection update ", update);
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        console.log(msg);
        if (!msg.key.fromMe && m.type === 'notify') {
            if (msg.message) {
                if (msg.message.conversation.includes('Format Laporan Harian') && !msg.message.conversation.includes('Berhasil dimasukkan')) {
                    console.log(msg.key.remoteJid);
                    console.log('msg_data: ', msg.message.conversation);

                    const text = msg.message.conversation;

                    // Splitting the text into lines
                    const lines = text.trim().split('\n');

                    // Extracting the relevant information
                    const data = {
                        tanggal: lines[1].trim().replace(/\*/g, ''),
                    };

                    let isKeteranganUangKeluar = false;
                    let keteranganUangKeluarList = [];
                    for (let i = 2; i < lines.length; i++) {
                        const line = lines[i].trim();

                        if (isKeteranganUangKeluar) {
                            if (line.startsWith('1.') || line.startsWith('1 ') || line.startsWith('1')) {
                                for (let a = i; a < lines.length; a++) {
                                    const line2 = lines[a].trim();
                                    const [key, value] = line2.split(':');
                                    const formattedKey = key.trim().replace(/^\d+\./, '').toLowerCase();
                                    let formattedValue = value.trim().replace(/Rp\./g, '').replace(/\s/g, '').toLowerCase();
                                    keteranganUangKeluarList.push([formattedKey, formattedValue]);
                                }
                                isKeteranganUangKeluar = false;
                                break;
                            }
                        } else if (line.includes(':')) {
                            const [key, value] = line.split(':');
                            const formattedKey = key.trim().replace(/\s/g, '').toLowerCase();
                            let formattedValue = value.trim().replace(/Rp\./g, '').replace(/\s/g, '').toLowerCase().replace(/pcs/g, '');

                            if (formattedKey === 'keteranganuangkeluar') {
                                isKeteranganUangKeluar = true;
                                keteranganUangKeluarList = [];
                            } else {
                                data[formattedKey] = formattedValue;
                            }
                        }
                    }

                    if (keteranganUangKeluarList.length > 0) {
                        data['keteranganuangkeluar'] = keteranganUangKeluarList;
                    }

                    const emptyData = [];

                    const tanggal = data.tanggal ? data.tanggal : emptyData.push('Tanggal tidak ada');
                    const cabang = data.cabangtoko ? data.cabangtoko : emptyData.push("Cabang Toko tidak ada");
                    const barangTerjual = typeof data.jumlahbarangterjual === 'string' && data.jumlahbarangterjual !== '' && !isNaN(data.jumlahbarangterjual) && data.jumlahbarangterjual !== '0' ? data.jumlahbarangterjual : emptyData.push('Jumlah Barang Terjual tidak ada');
                    const retur = typeof data.jumlahretur === 'string' && data.jumlahretur !== '' && !isNaN(data.jumlahretur) && data.jumlahretur !== '0' ? data.jumlahretur : emptyData.push('Jumlah Retur tidak ada');
                    const barangMasuk = typeof data.jumlahbarangmasuk === 'string' && data.jumlahbarangmasuk !== '' && !isNaN(data.jumlahbarangmasuk) && data.jumlahbarangmasuk !== '0' ? data.jumlahbarangmasuk : emptyData.push('Jumlah Barang Masuk tidak ada');
                    let keterangan = data.keteranganuangkeluar ? data.keteranganuangkeluar : emptyData.push("Keterangan Uang Keluar tidak ada");
                    let keterangan_api = keterangan 
                    let keterangan_str =''

                    axios.get(`${SHEET_URL}`)
                    .then(async (response) => {
                        const dataCategory = response.data.data
               
                        const additionalCategory = {
                          'harian': 'Gaji',
                          'transfer': 'Kas',
                        }

                        console.log(dataCategory)
                      
                        keterangan = keterangan.map(([key, value]) => {
                          const words = key.trim().split(' ');
                          let type = words.length > 1 ? words.shift() : words[0];
                          let ta = type
                          let data = type.toLowerCase() == 'harian' ? 'Harian ' + words.join(' ') : words.join(' ');
                          type = additionalCategory[type] ? additionalCategory[type] : (dataCategory.find(item => item.toLowerCase() === type) ? dataCategory.find(item => item.toLowerCase() === type) : 'Tidak Diketahui');
                          
                          if(type == "Tidak Diketahui"){
                            emptyData.push(`Keterangan Uang Keluar: ${data}, tambahkan kategori (spt: harian/gaji/pdam dll. didepannya) gunakan !kategori untuk melihat kategori`);
                          }
                          
                          return {
                            type,
                            data,
                            amount: value
                          };
                        });

                        if(emptyData.length > 0){
                            await sock.sendMessage(msg.key.remoteJid, {
                                quotes: msg,
                                text: `Data Tidak Di input terjadi kesalahan.\n
    Cabang: ${cabang}\n
    ${emptyData.join('\n')}`
                            });
                            return
                        }

                        console.log(data);
    
                        axios.post(`https://script.google.com/macros/s/AKfycbw-2TeIUFPccvEnBh3xkPpG0p7lnjoYcyMhZuSWiRjVHrZuu_i-nBWKDs01ZjErBgTt/exec?tanggal=${tanggal}&cabang=${cabang}&barangTerjual=${barangTerjual}&retur=${retur}&barangMasuk=${barangMasuk}&keterangan=${keterangan_api}`)
                        .then(async (response) => {
                            console.log(response.data);
                            if(response.data.success){
                                await sock.sendMessage(msg.key.remoteJid, {
                                    text: `Berhasil dimasukkan, Cabang: ${cabang}\nFormat Laporan Harian\nTanggal: ${tanggal}\nCabang Toko: ${cabang}\nOmset: Rp.${data.omset}\nUang Keluar: Rp.${data.uangkeluar}\nUang Sisa: Rp.${data.uangsisa}\nJumlah Barang Terjual: ${barangTerjual} PCS\nRetur: ${retur} pcs\nBarang Masuk: ${barangMasuk} pcs\nKeterangan Uang Keluar:\n${keterangan_api.map(([name, value]) => `${name}: Rp.${value}`).join('\n')}`
                                });
                            }else{
                                await sock.sendMessage(msg.key.remoteJid, {
                                    text: `Terjadi kesalahan input data, silahkan cek manual untuk typo atau semacamnya`
                                });
                            }
                        });
                    });

                } else if(msg.message.conversation.includes('!kategori')) {
                    axios.get(`${SHEET_URL}`)
                    .then(async (response) => {
                        const dataCategory = response.data.data
                        if(response.data.success){
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: `Kategori:\n ${dataCategory.join(',')}`
                            });
                        }else{
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: `Terjadi kesalahan input data, silahkan cek manual untuk typo atau semacamnya`
                            });
                        }
                    });
                }
            }
        }

        console.log('Received Message', JSON.stringify(msg));
    });
};

startSock();
