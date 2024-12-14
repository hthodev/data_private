const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');
const { HttpsProxyAgent } = require('https-proxy-agent');

const time_run = [5,6, 17, 23];

class TelegramAPIClient {
    constructor() {
        this.headers = {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Referer": "https://0xiceberg.com/",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
        this.proxyList = [];
        this.loadProxies();
    }

    loadProxies() {
        try {
            const proxyFile = path.join(__dirname, 'proxy.txt');
            this.proxyList = fs.readFileSync(proxyFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);
        } catch (error) {
            this.log('Không thể đọc file proxy.txt', 'error');
            this.proxyList = [];
        }
    }

    getAxiosConfig(index) {
        const config = {};
        if (this.proxyList.length > 0 && index < this.proxyList.length) {
            const proxyAgent = new HttpsProxyAgent(this.proxyList[index]);
            config.httpsAgent = proxyAgent;
        }
        return config;
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', {
                httpsAgent: proxyAgent,
                timeout: 10000
            });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [✓] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [✗] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [!] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [ℹ] ${msg}`.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i > 0; i--) {
            const timestamp = new Date().toLocaleTimeString();
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }

    async getBalance(authData, axiosConfig) {
        const url = "https://0xiceberg.com/api/v1/web-app/balance/";
        const headers = {
            ...this.headers,
            "X-Telegram-Auth": authData
        };

        try {
            const response = await axios.get(url, { 
                headers,
                ...axiosConfig
            });
            if (response.status === 200) {
                return { success: true, data: response.data };
            } else {
                return { success: false, error: response.data };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async handleFarming(authData, axiosConfig) {
        const url = "https://0xiceberg.com/api/v1/web-app/farming/";
        const headers = {
            ...this.headers,
            "X-Telegram-Auth": authData
        };

        try {
            const checkResponse = await axios.get(url, { 
                headers,
                ...axiosConfig
            });
            
            if (checkResponse.status === 200) {
                if (Object.keys(checkResponse.data).length === 0) {
                    const startResponse = await axios.post(url, {}, { 
                        headers,
                        ...axiosConfig
                    });
                    if (startResponse.status === 200) {
                        const startTime = DateTime.fromISO(startResponse.data.start_time);
                        const stopTime = DateTime.fromISO(startResponse.data.stop_time);
                        const duration = stopTime.diff(startTime).toFormat('hh:mm:ss');
                        this.log(`Bắt đầu farm mới - Thời gian hoàn thành: ${duration}`, 'success');
                    }
                } else {
                    const stopTime = DateTime.fromISO(checkResponse.data.stop_time);
                    const now = DateTime.now();
                    
                    if (stopTime < now) {
                        const collectUrl = "https://0xiceberg.com/api/v1/web-app/farming/collect/";
                        await axios.delete(collectUrl, { 
                            headers,
                            ...axiosConfig
                        });
                        this.log('Thu hoạch farm thành công', 'success');

                        const startResponse = await axios.post(url, {}, { 
                            headers,
                            ...axiosConfig
                        });
                        if (startResponse.status === 200) {
                            const startTime = DateTime.fromISO(startResponse.data.start_time);
                            const newStopTime = DateTime.fromISO(startResponse.data.stop_time);
                            const duration = newStopTime.diff(startTime).toFormat('hh:mm:ss');
                            this.log(`Bắt đầu farm mới - Thời gian hoàn thành: ${duration}`, 'success');
                        }
                    } else {
                        const timeLeft = stopTime.diff(now).toFormat('hh:mm:ss');
                        this.log(`Farm đang chạy - Thời gian còn lại: ${timeLeft}`, 'info');
                    }
                }
                return { success: true };
            }
            return { success: false, error: "Failed to check farming status" };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async handleAdInteraction(authData, axiosConfig, retryCount = 0) {
        const MAX_RETRIES = 3;
        try {
            const userCheckUrl = "https://0xiceberg.com/api/v1/users/user/current-user/";
            const baseHeaders = {
                ...this.headers,
                "X-Telegram-Auth": authData
            };
    
            const userResponse = await axios.get(userCheckUrl, { 
                headers: baseHeaders,
                ...axiosConfig
            });
            if (userResponse.status !== 200) {
                throw new Error("Failed to fetch user data");
            }
    
            const { adsgram_counter, chat_id } = userResponse.data;
            
            if (adsgram_counter >= 20) {
                this.log("Đã đạt đến giới hạn xem quảng cáo (20/20)", 'warning');
                return { success: false, reason: "limit_reached" };
            }
    
            this.log(`Số lượng quảng cáo hiện tại: ${adsgram_counter}/20`, 'info');
    
            const adsgramHeaders = {
                ...this.headers,
                "Origin": "https://0xiceberg.com",
                "Sec-Fetch-Site": "cross-site",
            };
    
            const adUrl = `https://api.adsgram.ai/adv?blockId=3721&tg_id=${chat_id}&tg_platform=android&platform=Win32&language=vi&top_domain=0xiceberg.com`;
            const adResponse = await axios.get(adUrl, { 
                headers: adsgramHeaders,
                ...axiosConfig
            });
            
            if (adResponse.status !== 200) {
                throw new Error("Failed to fetch advertisement data");
            }
    
            const { trackings } = adResponse.data.banner;
            
            await axios.get(trackings.find(t => t.name === "render").value, {
                headers: adsgramHeaders,
                ...axiosConfig
            });

            await new Promise(resolve => setTimeout(resolve, 5000));
            await axios.get(trackings.find(t => t.name === "show").value, {
                headers: adsgramHeaders,
                ...axiosConfig
            });

            await new Promise(resolve => setTimeout(resolve, 10000));
            await axios.get(trackings.find(t => t.name === "reward").value, {
                headers: adsgramHeaders,
                ...axiosConfig
            });
    
            const verifyResponse = await axios.get(userCheckUrl, { 
                headers: baseHeaders,
                ...axiosConfig
            });
            if (verifyResponse.data.adsgram_counter !== adsgram_counter + 1) {
                throw new Error("Ad interaction was not counted properly");
            }
    
            this.log(`Xem Quảng Cáo Thành Công. Đã xem: ${verifyResponse.data.adsgram_counter}/20`, 'success');
            return { success: true, newCount: verifyResponse.data.adsgram_counter };
    
        } catch (error) {
            if (error.response?.status === 400 && retryCount < MAX_RETRIES) {
                this.log(`Lần thử ${retryCount + 1} thất bại, đang thử lại...`, 'warning');
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.handleAdInteraction(authData, axiosConfig, retryCount + 1);
            }
            
            this.log(`Xem Quảng Cáo Thất Bại Sau ${retryCount + 1} Lần Thử: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async handleTasks(authData, axiosConfig) {
        const url = "https://0xiceberg.com/api/v1/web-app/tasks/";
        const headers = {
            ...this.headers,
            "X-Telegram-Auth": authData
        };

        try {
            const tasksResponse = await axios.get(url, { 
                headers,
                ...axiosConfig
            });
            if (tasksResponse.status !== 200) {
                throw new Error("Failed to fetch tasks");
            }

            const newTasks = tasksResponse.data.filter(task => task.status === "new");

            for (const task of newTasks) {
                const taskUrl = `${url}task/${task.id}/`;
                
                const startResponse = await axios.patch(taskUrl, 
                    { status: "in_work" },
                    { 
                        headers,
                        ...axiosConfig
                    }
                );

                if (!startResponse.data.success) {
                    this.log(`Không thể bắt đầu nhiệm vụ ${task.id}`, 'error');
                    continue;
                }

                await new Promise(resolve => setTimeout(resolve, 5000));

                const readyResponse = await axios.patch(taskUrl,
                    { status: "ready_collect" },
                    { 
                        headers,
                        ...axiosConfig
                    }
                );

                if (!readyResponse.data.success) {
                    this.log(`Không thể hoàn thành nhiệm vụ ${task.id}`, 'error');
                    continue;
                }

                const collectResponse = await axios.patch(taskUrl,
                    { status: "collected" },
                    { 
                        headers,
                        ...axiosConfig
                    }
                );

                if (collectResponse.data.success) {
                    this.log(`Làm nhiệm vụ ${task.description} thành công | Phần thưởng: ${task.price}`, 'success');
                } else {
                    this.log(`Không thể thu thưởng nhiệm vụ ${task.id}`, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            return { success: true };
        } catch (error) {
            this.log(`Lỗi xử lý nhiệm vụ: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            while (!isAllowedToRun()) {
                console.log("Outside allowed hours, waiting...");
                await new Promise(resolve => setTimeout(resolve, 1000 * 60));
            }
            console.log("Allowed hours, running client...");
            for (let i = 0; i < data.length; i++) {
                const authData = data[i];
                const userData = JSON.parse(decodeURIComponent(authData.split('user=')[1].split('&')[0]));
                const userId = userData.id;
                const firstName = userData.first_name;
                
                let proxyIP = "No proxy";
                const axiosConfig = this.getAxiosConfig(i);
                
                if (this.proxyList[i]) {
                    try {
                        proxyIP = await this.checkProxyIP(this.proxyList[i]);
                    } catch (error) {
                        this.log(`Lỗi kiểm tra IP proxy: ${error.message}`, 'warning');
                        continue;
                    }
                }

                console.log(`========== Tài khoản ${i + 1} | ${firstName.green} | ip: ${proxyIP} ==========`);
                
                this.log(`Đang kiểm tra số dư tài khoản ${userId}...`, 'info');
                const balanceResult = await this.getBalance(authData, axiosConfig);
                
                if (balanceResult.success) {
                    this.log(`Số dư: ${balanceResult.data.amount}`, 'success');
                    this.log(`Count reset: ${balanceResult.data.count_reset}`, 'info');
                } else {
                    this.log(`Không thể lấy số dư: ${balanceResult.error}`, 'error');
                }

                this.log(`Đang kiểm tra trạng thái farm...`, 'info');
                const farmingResult = await this.handleFarming(authData, axiosConfig);
                if (!farmingResult.success) {
                    this.log(`Lỗi farming: ${farmingResult.error}`, 'error');
                }

                this.log(`Đang kiểm tra nhiệm vụ...`, 'info');
                const tasksResult = await this.handleTasks(authData, axiosConfig);
                if (!tasksResult.success) {
                    this.log(`Lỗi xử lý nhiệm vụ: ${tasksResult.error}`, 'error');
                }

                this.log(`Đang kiểm tra quảng cáo...`, 'info');
                while (true) {
                    const adResult = await this.handleAdInteraction(authData, axiosConfig);
                    if (!adResult.success) {
                        if (adResult.reason === "limit_reached") {
                            break;
                        }
                        this.log(`Lỗi xử lý quảng cáo: ${adResult.error}`, 'error');
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(6 * 60);
        }
    }
}

const client = new TelegramAPIClient();
function isAllowedToRun() {
    const currentHour = new Date().getHours();
    return time_run.includes(currentHour);
}

async function runClient() {
    try {
        await client.main();
    } catch (err) {
        client.log(err.message, 'error');
        process.exit(1);
    }
}

runClient();