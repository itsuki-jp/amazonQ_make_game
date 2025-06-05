/**
 * ボールクラス
 */
class Ball {
    constructor(x, y, radius, color, isPlayer) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.isMoving = false;
        this.isPlayer = isPlayer; // プレイヤーのボールかCPUのボールか
        this.mass = 1; // 質量（すべて同じ）
        this.scored = false; // 相手陣地に到達したかどうか
    }

    /**
     * ボールを描画する
     * @param {CanvasRenderingContext2D} ctx - キャンバスのコンテキスト
     */
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();
    }
}

/**
 * 壁クラス
 */
class Wall {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    /**
     * 壁を描画する
     * @param {CanvasRenderingContext2D} ctx - キャンバスのコンテキスト
     */
    draw(ctx) {
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    }
}

/**
 * 穴クラス
 */
class Hole {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
    }

    /**
     * 穴を描画する
     * @param {CanvasRenderingContext2D} ctx - キャンバスのコンテキスト
     */
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.closePath();
    }
}

/**
 * ゲームクラス
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 500;
        
        this.ballRadius = 15;
        this.wallThickness = 10;
        
        // 物理エンジンの初期化
        this.physics = new PhysicsEngine();
        
        // 中央の壁と穴の設定
        this.wall = new Wall(
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.wallThickness,
            this.canvas.height
        );
        
        this.hole = new Hole(
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.ballRadius * 2 // 穴の直径はボールの直径の2倍
        );
        
        // ゲームの状態
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.currentBall = null;
        this.currentMouseX = null;
        this.currentMouseY = null;
        this.playerTurn = true;
        this.gameOver = false;
        this.cpuActionScheduled = false;
        
        // スコア表示要素
        this.playerScoreElement = document.getElementById('playerScore');
        this.cpuScoreElement = document.getElementById('cpuScore');
        
        // ボールの初期化
        this.initBalls();
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        // CPUの行動タイマー
        this.cpuActionTimer = null;
        
        // ゲームループの開始
        this.gameLoop();
        
        console.log("ゲーム初期化完了");
    }
    
    /**
     * ボールを初期化する
     */
    initBalls() {
        this.playerBalls = [];
        this.cpuBalls = [];
        
        // プレイヤーのボールを配置
        const playerStartX = this.canvas.width / 4;
        for (let i = 0; i < 4; i++) {
            const y = 100 + i * 80;
            this.playerBalls.push(new Ball(playerStartX, y, this.ballRadius, '#3498db', true));
        }
        
        // CPUのボールを配置
        const cpuStartX = this.canvas.width * 3 / 4;
        for (let i = 0; i < 4; i++) {
            const y = 100 + i * 80;
            this.cpuBalls.push(new Ball(cpuStartX, y, this.ballRadius, '#e74c3c', false));
        }
        
        console.log("ボールを初期化:", 
            "プレイヤー:", this.playerBalls.length, 
            "CPU:", this.cpuBalls.length);
        
        this.updateScoreDisplay();
    }
    
    /**
     * イベントリスナーを設定する
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        // mousemoveイベントをdocumentに設定（キャンバス外でもドラッグを継続できるように）
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        // mouseupイベントもdocumentに設定
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.getElementById('restartButton').addEventListener('click', this.restartGame.bind(this));
    }
    
    /**
     * マウスダウンイベントを処理する
     * @param {MouseEvent} e - マウスイベント
     */
    handleMouseDown(e) {
        if (this.gameOver || !this.playerTurn) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // クリックしたボールを探す
        for (const ball of this.playerBalls) {
            if (!ball.scored && !ball.isMoving) {
                const dx = mouseX - ball.x;
                const dy = mouseY - ball.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < ball.radius) {
                    this.isDragging = true;
                    this.startX = mouseX;
                    this.startY = mouseY;
                    this.currentBall = ball;
                    break;
                }
            }
        }
    }
    
    /**
     * マウス移動イベントを処理する
     * @param {MouseEvent} e - マウスイベント
     */
    handleMouseMove(e) {
        if (!this.isDragging || this.gameOver) return;
        
        // マウス位置を取得（キャンバス外でもドラッグを継続できるように）
        // documentを基準にした座標を使用
        const rect = this.canvas.getBoundingClientRect();
        let mouseX = e.clientX - rect.left;
        let mouseY = e.clientY - rect.top;
        
        // 現在のマウス位置を保存（draw()メソッドで使用）
        this.currentMouseX = mouseX;
        this.currentMouseY = mouseY;
        
        // 再描画（矢印はdraw()メソッドの最後で描画される）
        this.draw();
    }
    
    /**
     * マウスアップイベントを処理する
     * @param {MouseEvent} e - マウスイベント
     */
    handleMouseUp(e) {
        if (!this.isDragging || this.gameOver) return;
        
        // マウス位置を取得（キャンバス外でもドラッグを継続できるように）
        const rect = this.canvas.getBoundingClientRect();
        let mouseX = e.clientX - rect.left;
        let mouseY = e.clientY - rect.top;
        
        // 発射方向と強さを計算
        const dx = mouseX - this.startX;
        const dy = mouseY - this.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 最小距離チェック（クリックのみの場合は発射しない）
        if (distance < 5) {
            this.isDragging = false;
            this.currentBall = null;
            this.currentMouseX = null;
            this.currentMouseY = null;
            return;
        }
        
        // 最大速度を制限
        const maxSpeed = 15;
        const speed = Math.min(distance / 10, maxSpeed);
        
        // ボールに速度を設定（ドラッグ方向とは逆向きに発射）
        this.currentBall.vx = -(dx / distance) * speed;
        this.currentBall.vy = -(dy / distance) * speed;
        this.currentBall.isMoving = true;
        
        console.log("プレイヤーのボールを発射:", this.currentBall.vx, this.currentBall.vy);
        
        this.isDragging = false;
        this.currentBall = null;
        this.currentMouseX = null;
        this.currentMouseY = null;
        
        // プレイヤーのターンは継続（別の玉を打てるようにする）
        // ただし、すべての玉が動いている場合はCPUのターンに移行
        const allPlayerBallsMovingOrScored = this.playerBalls.every(ball => ball.isMoving || ball.scored);
        if (allPlayerBallsMovingOrScored) {
            console.log("すべてのプレイヤーボールが動いているか得点済み、CPUターンに移行");
            this.playerTurn = false;
            this.cpuActionScheduled = false; // CPUの行動をリセット
            
            // ボールが停止するまで待ってからCPUの行動を実行
            const checkAndExecute = () => {
                if (!this.isAnyBallMoving()) {
                    // ボールが停止したらCPUの行動を実行
                    console.log("ボールが停止したのでCPUの行動を実行");
                    this.forceCPUAction();
                } else {
                    // まだボールが動いている場合は再チェック
                    setTimeout(checkAndExecute, 500);
                }
            };
            
            // 最初のチェックを開始
            setTimeout(checkAndExecute, 500);
        }
    }
    
    /**
     * CPUの行動をスケジュールする
     */
    scheduleCPUAction() {
        // コンソールに直接出力（デバッグ用）
        console.log("CPUの行動をスケジュール");
        
        // すべてのボールが停止するまで待つ
        if (this.isAnyBallMoving()) {
            console.log("ボールが動いているため待機中...");
            setTimeout(() => this.scheduleCPUAction(), 100);
            return;
        }
        
        console.log("すべてのボールが停止、CPUの行動を準備");
        
        // CPUの行動を遅延させる
        this.cpuActionTimer = setTimeout(() => {
            console.log("CPUの行動を開始");
            this.cpuAction();
            this.playerTurn = true;
            this.cpuActionScheduled = false;
            console.log("プレイヤーのターンに切り替え");
        }, 1000);
    }
    
    /**
     * CPUの行動を実行する
     */
    cpuAction() {
        console.log("CPUの行動を実行");
        
        // 動かせるCPUのボールを探す
        const availableBalls = this.cpuBalls.filter(ball => !ball.scored && !ball.isMoving);
        console.log("動かせるCPUのボール数:", availableBalls.length);
        
        if (availableBalls.length === 0) {
            console.log("動かせるCPUのボールがありません");
            return;
        }
        
        // 最前列のボールを選択（x座標が最も小さいもの）
        const targetBall = availableBalls.reduce((prev, current) => 
            (current.x < prev.x) ? current : prev, availableBalls[0]);
        
        console.log("選択されたCPUボール:", targetBall);
        
        // 穴に向かって発射
        const dx = this.hole.x - targetBall.x;
        const dy = this.hole.y - targetBall.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 速度を設定（より強く、より正確に）
        const speed = 8 + Math.random() * 2; // 8〜10の範囲でランダム
        targetBall.vx = (dx / distance) * speed;
        targetBall.vy = (dy / distance) * speed;
        targetBall.isMoving = true;
        
        console.log("CPUボールに速度を設定:", targetBall.vx, targetBall.vy);
    }
    
    /**
     * いずれかのボールが動いているかチェックする
     * @returns {boolean} - ボールが動いている場合はtrue
     */
    isAnyBallMoving() {
        const moving = [...this.playerBalls, ...this.cpuBalls].some(ball => ball.isMoving);
        console.log("ボールの動き状態:", moving ? "動いている" : "停止している");
        return moving;
    }
    
    /**
     * スコア表示を更新する
     */
    updateScoreDisplay() {
        const playerRemaining = this.playerBalls.filter(ball => !ball.scored).length;
        const cpuRemaining = this.cpuBalls.filter(ball => !ball.scored).length;
        
        this.playerScoreElement.textContent = `プレイヤーの残り玉: ${playerRemaining}`;
        this.cpuScoreElement.textContent = `CPUの残り玉: ${cpuRemaining}`;
        
        // 勝敗判定
        if (playerRemaining === 0) {
            this.gameOver = true;
            setTimeout(() => alert('プレイヤーの勝利！'), 100);
        } else if (cpuRemaining === 0) {
            this.gameOver = true;
            setTimeout(() => alert('CPUの勝利！'), 100);
        }
    }
    
    /**
     * ゲームを再起動する
     */
    restartGame() {
        // CPUのタイマーをクリア
        if (this.cpuActionTimer) {
            clearTimeout(this.cpuActionTimer);
        }
        
        // ゲーム状態をリセット
        this.initBalls();
        this.isDragging = false;
        this.currentBall = null;
        this.playerTurn = true;
        this.gameOver = false;
    }
    
    /**
     * ゲームの状態を更新する
     */
    update() {
        const boundaries = {
            width: this.canvas.width,
            height: this.canvas.height
        };
        
        // すべてのボールの位置を更新
        [...this.playerBalls, ...this.cpuBalls].forEach(ball => {
            if (ball.isMoving) {
                this.physics.updateBall(ball, boundaries, this.wall, this.hole);
            }
        });
        
        // ボール同士の衝突判定
        const allBalls = [...this.playerBalls, ...this.cpuBalls];
        for (let i = 0; i < allBalls.length; i++) {
            for (let j = i + 1; j < allBalls.length; j++) {
                this.physics.checkBallCollision(allBalls[i], allBalls[j]);
            }
        }
        
        // スコアの判定（相手陣地に到達したボールをチェック）
        this.playerBalls.forEach(ball => {
            if (!ball.scored && ball.x > this.canvas.width / 2) {
                ball.scored = true;
                this.updateScoreDisplay();
            }
        });
        
        this.cpuBalls.forEach(ball => {
            if (!ball.scored && ball.x < this.canvas.width / 2) {
                ball.scored = true;
                this.updateScoreDisplay();
            }
        });
        
        // CPUのターンで、ボールが停止している場合はCPUの行動を実行
        if (!this.playerTurn && !this.isAnyBallMoving() && !this.cpuActionScheduled) {
            console.log("update内: CPUのターンでボールが停止しているため行動を実行");
            this.cpuActionScheduled = true;
            
            // 少し遅延させてCPUの行動を実行
            setTimeout(() => {
                this.forceCPUAction();
            }, 500);
        }
    }
    
    /**
     * ゲームを描画する
     */
    draw() {
        // キャンバスをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // フィールドの背景を描画
        this.ctx.fillStyle = '#e8f4f8'; // プレイヤー側
        this.ctx.fillRect(0, 0, this.canvas.width / 2, this.canvas.height);
        this.ctx.fillStyle = '#f8e8e8'; // CPU側
        this.ctx.fillRect(this.canvas.width / 2, 0, this.canvas.width / 2, this.canvas.height);
        
        // 中央線を描画
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.strokeStyle = '#999';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        // ボールを描画
        [...this.playerBalls, ...this.cpuBalls].forEach(ball => {
            // すべてのボールを表示
            ball.draw(this.ctx);
        });
        
        // 壁を描画（ボールの上に表示）
        this.wall.draw(this.ctx);
        
        // 穴を描画
        this.hole.draw(this.ctx);
        
        // ゲーム終了時のみメッセージを表示
        if (this.gameOver) {
            this.ctx.font = '20px Arial';
            this.ctx.fillStyle = '#333';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('ゲーム終了', this.canvas.width / 2, 30);
        }
        
        // ドラッグ中の矢印を描画（最後に描画して他の要素に上書きされないようにする）
        if (this.isDragging && this.currentBall && this.currentMouseX && this.currentMouseY) {
            this.drawArrow();
        }
    }
    
    /**
     * ドラッグ中の矢印を描画する
     */
    drawArrow() {
        // 発射方向と強さを計算（ドラッグの方向とは逆向きに矢印を表示）
        const dx = this.currentMouseX - this.startX;
        const dy = this.currentMouseY - this.startY;
        const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 150); // 最大距離を制限
        const angle = Math.atan2(dy, dx) + Math.PI; // 180度反転
        
        // 矢印の長さを強さに比例させる
        const arrowLength = distance;
        const arrowEndX = this.currentBall.x + Math.cos(angle) * arrowLength;
        const arrowEndY = this.currentBall.y + Math.sin(angle) * arrowLength;
        
        // 矢印の太さを強さに比例させる
        const lineWidth = 2 + (distance / 50);
        
        // 発射方向と強さを示す矢印を描画
        this.ctx.beginPath();
        this.ctx.moveTo(this.currentBall.x, this.currentBall.y);
        this.ctx.lineTo(arrowEndX, arrowEndY);
        this.ctx.strokeStyle = '#ff0000'; // 赤色で視認性を高める
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();
        
        // 矢印の先端を描画
        const headLength = 15 + (distance / 15);
        this.ctx.beginPath();
        this.ctx.moveTo(arrowEndX, arrowEndY);
        this.ctx.lineTo(
            arrowEndX - headLength * Math.cos(angle - Math.PI / 6),
            arrowEndY - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
            arrowEndX - headLength * Math.cos(angle + Math.PI / 6),
            arrowEndY - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fillStyle = '#ff0000'; // 赤色で視認性を高める
        this.ctx.fill();
        
        // 強さのインジケーターを表示
        const powerPercent = Math.min(distance / 150 * 100, 100).toFixed(0);
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillStyle = '#ffffff'; // 白色
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000000'; // 黒い縁取り
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(`${powerPercent}%`, arrowEndX, arrowEndY - 15);
        this.ctx.fillText(`${powerPercent}%`, arrowEndX, arrowEndY - 15);
    }
    
    /**
     * ゲームループ
     */
    gameLoop() {
        this.update();
        this.draw();
        
        // CPUのターンで、ボールが停止している場合はCPUの行動を実行
        if (!this.playerTurn && !this.isAnyBallMoving() && !this.cpuActionScheduled) {
            console.log("CPUのターンでボールが停止しているため行動を実行");
            this.cpuActionScheduled = true;
            
            // 少し遅延させてCPUの行動を実行（視覚的にわかりやすくするため）
            setTimeout(() => {
                this.forceCPUAction();
            }, 500);
        }
        
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    /**
     * CPUの行動を強制的に実行する（スケジューリングをバイパス）
     */
    forceCPUAction() {
        console.log("CPUの行動を強制実行");
        
        // 動かせるCPUのボールを探す
        const availableBalls = this.cpuBalls.filter(ball => !ball.scored && !ball.isMoving);
        console.log("動かせるCPUのボール数:", availableBalls.length);
        
        if (availableBalls.length === 0) {
            console.log("動かせるCPUのボールがありません");
            this.playerTurn = true;
            this.cpuActionScheduled = false;
            return;
        }
        
        // 最前列のボールを選択（x座標が最も小さいもの）
        const targetBall = availableBalls.reduce((prev, current) => 
            (current.x < prev.x) ? current : prev, availableBalls[0]);
        
        console.log("選択されたCPUボール:", targetBall);
        
        // 穴に向かって発射
        const dx = this.hole.x - targetBall.x;
        const dy = this.hole.y - targetBall.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 速度を設定（より強く、より正確に）
        const speed = 10; // 固定の強い速度
        targetBall.vx = (dx / distance) * speed;
        targetBall.vy = (dy / distance) * speed;
        targetBall.isMoving = true;
        
        console.log("CPUボールに速度を設定:", targetBall.vx, targetBall.vy);
        
        // アラートでCPUの行動を通知（デバッグ用）
        alert("CPUがボールを発射しました！");
        
        // プレイヤーのターンに戻す（ボールが停止した後）
        setTimeout(() => {
            if (!this.isAnyBallMoving()) {
                this.playerTurn = true;
                this.cpuActionScheduled = false;
                console.log("プレイヤーのターンに切り替え");
            } else {
                // まだボールが動いている場合は再チェック
                const checkAgain = () => {
                    if (!this.isAnyBallMoving()) {
                        this.playerTurn = true;
                        this.cpuActionScheduled = false;
                        console.log("プレイヤーのターンに切り替え（遅延）");
                    } else {
                        setTimeout(checkAgain, 500);
                    }
                };
                setTimeout(checkAgain, 500);
            }
        }, 1000);
    }
}

// ページ読み込み時にゲームを開始
window.addEventListener('load', () => {
    new Game();
});
