const { DisconnectReason, useMultiFileAuthState } = require('baileys');
const makeWASocket = require('baileys').default;

const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'botwa'
});

const dbQuery = (sqlQuery) => {
    return new Promise((resolve, reject) => {
      connection.query(sqlQuery, (err, results) => {
        if (err) {
          console.error('Error executing query:', err);
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  };
  
try {
    const data = dbQuery('SELECT * FROM layanan');
    for (i=0; i++; i<data.length){
        console.log(data.row.nama)
    }
} catch (error) {
    console.log(error)
}


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
            console.log("Koneksi dihentikan sementara, sambil menunggu pesan masuk");
        }

        console.log("Koneksi terhubung kembali", update);
    });

    let ongoing_chat = []

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        console.log(msg);
        if (!msg.key.fromMe && m.type === 'notify') {
            if (msg.message) {
                if (msg.message.conversation.includes('#simpati') && !msg.message.conversation.includes('Berhasil dimasukkan')) {
                    if(ongoing_chat.find(chat => chat.sender === msg.key.remoteJid)){
                        try {
                            const index = ongoing_chat.findIndex(chat => chat.sender === msg.key.remoteJid);
    
                            if (index !== -1) {
                            ongoing_chat.splice(index, 1);
                            }
    
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: `Permintaan Sebelumnya di reset, silahkan ulangi kembali`
                            });
                        } catch (error) {
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: `Permintaan Sebelumnya gagal di reset, silahkan ulangi kembali`
                            });
                        }
                    }
                    
                    console.log('Pesan berformat terdeteksi:\n');
                    console.log('Sender:' + msg.key.remoteJid);
                    console.log('Pesan: ', msg.message.conversation);

                    const text = msg.message.conversation;

                    const layanan = await dbQuery("SELECT * FROM layanan")

                    if (layanan.length > 0){
                        let string_layanan = "Daftar Layanan:"
                        for (let i = 0; i < layanan.length; i++) {
                            string_layanan += `\n${i+1}. ${layanan[i].nama}`
                        }

                        await sock.sendMessage(msg.key.remoteJid, {
                            text: "Selamat Datang di *Bot Pelayanan Masyarakat Desa Kabupaten Sumedang*"
                        });
    
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: string_layanan
                        });

                        await sock.sendMessage(msg.key.remoteJid, {
                            text: "Silahkan pilih salah satu layanan diatas dengan cara langsung membalas dengan nomor urut layanan *(hanya angka)*"
                        });

                    }else{
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: "Selamat Datang di *Bot Pelayanan Masyarakat Desa Kabupaten Sumedang*"
                        });

                        await sock.sendMessage(msg.key.remoteJid, {
                            text: "Saat ini Daftar Layanan Sedang Tidak Tersedia"
                        });
                    }

                    await sock.sendMessage(msg.key.remoteJid, {
                        text: "_Untuk membatalkan permintaan silahkan balas dengan *Batal*_"
                    });

                    ongoing_chat.push({sender: msg.key.remoteJid, step:1, data:{}, masyarakat:{}})

                } else if(ongoing_chat.some(data => data.sender === msg.key.remoteJid) && ongoing_chat.some(data => data.step === 1) && !isNaN(msg.message.conversation) && (msg.message.conversation.length === 1 || msg.message.conversation.length === 2)) {
                    // step konfirmasi layanan

                    let data = ongoing_chat.find(chat => chat.sender === msg.key.remoteJid);

                    let layanan = []
                    try {
                        layanan = await dbQuery(`SELECT * FROM layanan WHERE id = ${msg.message.conversation}`)
                    } catch (error) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: "Maaf, Terjadi Kesalahan"
                        });
                    }

                    if (layanan.length > 0){
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `✔ Anda memilih ${layanan[0].nama}`
                        }); 

                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `Silahkan masukkan nomor NIK anda tanpa spasi`
                        }); 

                        data.data[0] = {
                            layanan: layanan[0].id,
                            nama_layanan: layanan[0].nama
                        }

                        data.step = 2
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: "Silahkan ulangi pilihan Layanan"
                        });
                    }

                } else if(ongoing_chat.some(data => data.sender === msg.key.remoteJid) && ongoing_chat.some(data => data.step === 2) && !isNaN(msg.message.conversation) && (msg.message.conversation.length === 16)) {
                    // step input nik

                    let data = ongoing_chat.find(chat => chat.sender === msg.key.remoteJid);

                    let persyaratan_layanan = []
                    try {
                        persyaratan_layanan = await dbQuery(`SELECT dokumen_layanan.*, layanan.nama as layanan FROM dokumen_layanan INNER JOIN layanan on dokumen_layanan.layanan_id = layanan.id WHERE dokumen_layanan.layanan_id = ${data.data[0].layanan}`)
                        console.log(persyaratan_layanan)
                    } catch (error) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: "Maaf, Terjadi Kesalahan dalam memunculkan persyaratan layanan, harap ketik ADMIN untuk bantuan."
                        });
                    }

                    let masyarakat = []
                    try {
                        masyarakat = await dbQuery(`SELECT * FROM masyarakat WHERE nik = ${msg.message.conversation}`)
                    } catch (error) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: "❌ NIK yang anda masukkan tidak valid, silahkan masukkan ulang NIK"
                        });
                    }

                    if (masyarakat.length > 0){
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `✅ NIK yang anda masukkan valid`
                        }); 

                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `NIK: ${masyarakat[0].nik}\nNAMA:${masyarakat[0].nama}\nAlamat:${masyarakat[0].alamat}`
                        }); 

                        data.masyarakat = masyarakat[0]

                        let string_persyaratan_layanan = "Untuk memulai surat silahkan siapkan data berikut:"
                        data.data[0].persyaratan_layanan = []
                        for (let i = 0; i < persyaratan_layanan.length; i++) {
                            string_persyaratan_layanan += `\n${i+1}. ${persyaratan_layanan[i].nama}`
                            data.data[0].persyaratan_layanan.push(persyaratan_layanan[i])
                            data.data[0].persyaratan_layanan[i].answered = false;
                        }
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: string_persyaratan_layanan
                        });

                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `▶ Silahkan Masukkan ${data.data[0].persyaratan_layanan[0].nama}`,
                        });

                        data.persyaratan_step = 0;
                        data.persyaratan_length = persyaratan_layanan.length;

                        data.step = 3
                          
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: "❌ NIK yang anda masukkan tidak valid, silahkan masukkan ulang NIK"
                        });
                    }
                } else if(ongoing_chat.some(data => data.sender === msg.key.remoteJid) && ongoing_chat.some(data => data.step === 3) ){
                    // input dan check persyaratan
                    let data = ongoing_chat.find(chat => chat.sender === msg.key.remoteJid);
                      
                    const text = msg.message.conversation
                    const persyaratan_step = data.persyaratan_step;
                    if (persyaratan_step < data.persyaratan_length){
                        try {
                            data.data[0].persyaratan_layanan[persyaratan_step].answer = text
                            data.data[0].persyaratan_layanan[persyaratan_step].answered = true;

                            await sock.sendMessage(msg.key.remoteJid, {
                                text: `▶ Data ${data.data[0].persyaratan_layanan[persyaratan_step].nama} berhasil dimasukkan\nData:\n${data.data[0].persyaratan_layanan[persyaratan_step].answer}`,
                            });
    
                            data.persyaratan_step = persyaratan_step + 1

                            if (data.persyaratan_step < data.persyaratan_length){
                                await sock.sendMessage(msg.key.remoteJid, {
                                    text: `▶ Silahkan Masukkan ${data.data[0].persyaratan_layanan[data.persyaratan_step].nama}`,
                                });
                            }
                            
                        } catch (error) {
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: `▶ Data ${data.data[0].persyaratan_layanan[persyaratan_step].nama} gagal dimasukkan. Silahkan coba lagi, ${error}`,
                            });
                        }
                    }
                                            
                    if (data.persyaratan_step == data.persyaratan_length) {
                        data.step = 4;
                        let string_data_pesyaratan = ''
                        for (let i = 0; i < data.data[0].persyaratan_layanan.length; i++) {
                            if(i == 0){
                                string_data_pesyaratan += `${data.data[0].persyaratan_layanan[i].nama}: ${data.data[0].persyaratan_layanan[i].answer}`
                            }else{
                                string_data_pesyaratan += `\n${data.data[0].persyaratan_layanan[i].nama}: ${data.data[0].persyaratan_layanan[i].answer}`
                            }
                        }
                    const message = `📄 Konfirmasi Pengisian\n-----------------------------
NIK : ${data.masyarakat.nik}
Nama Lengkap : ${data.masyarakat.nama}
Alamat : ${data.masyarakat.alamat}\n
${data.data[0].nama_layanan}
${string_data_pesyaratan}\n
-----------------------------
Balas dengan Ya apabila semua data sudah sesuai
atau Balas dengan Tidak untuk mengulangi pengisian Persyaratan\n
Apakah semua data diatas sudah benar ? (Ya/Tidak)`;
                      
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: message,
                    });
                    }
                    
                } else if(ongoing_chat.some(data => data.sender === msg.key.remoteJid) && ongoing_chat.some(data => data.step === 4) ){
                    // step konfirmasi input dan selesai
                    if(msg.message.conversation.toLowerCase().includes('tidak')){
                        let data = ongoing_chat.find(chat => chat.sender === msg.key.remoteJid);
                        data.persyaratan_step = 0
                        data.step = 3
                        
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `▶ Silahkan Ulangi Masukkan ${data.data[0].persyaratan_layanan[0].nama}`,
                        });

                    }else if(msg.message.conversation.toLowerCase().includes('ya')){
                        let data = ongoing_chat.find(chat => chat.sender === msg.key.remoteJid);
                        
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `${data.data[0].nama_layanan} Sedang di Proses`,
                        });

                        try {
                            const index = ongoing_chat.findIndex(chat => chat.sender === msg.key.remoteJid);
    
                            if (index !== -1) {
                            ongoing_chat.splice(index, 1);
                            }
    
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: `Permintaan Berhasil ditambahkan`
                            });
                        } catch (error) {
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: `Permintaan Gagal ditambahkan`
                            });
                        }
                    }
                
                } else if(msg.message.conversation.toLowerCase().includes('batal')) {
                    // step batal
                    console.log('Pesan permintaan dibatalkan terdeteksi\n');
                    try {
                        const index = ongoing_chat.findIndex(chat => chat.sender === msg.key.remoteJid);

                        if (index !== -1) {
                        ongoing_chat.splice(index, 1);
                        }

                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `Permintaan Berhasil dibatalkan`
                        });
                    } catch (error) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `Permintaan Gagal dibatalkan`
                        });
                    }
                   

                } else{
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `Selamat Datang di *Bot Pelayanan Masyarakat Desa Kabupaten Sumedang*\n Harap gunakan #simpati untuk menggunakan bot`
                    });
                }
            }
        }

    });
};

startSock();
