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
        
        // デバッグモード
        this.debugMode = true;
        
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
        if (this.gameOver) return;
        
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
        
        // 最大速度を制限（値を大きくして勢いの限度を上げる）
        const maxSpeed = 35; // 25から35に増加
        const speed = Math.min(distance / 7, maxSpeed); // 係数も8から7に変更してより速く
        
        // ボールに速度を設定（ドラッグ方向とは逆向きに発射）
        this.currentBall.vx = -(dx / distance) * speed;
        this.currentBall.vy = -(dy / distance) * speed;
        this.currentBall.isMoving = true;
        
        console.log("プレイヤーのボールを発射:", this.currentBall.vx, this.currentBall.vy);
        
        this.isDragging = false;
        this.currentBall = null;
        this.currentMouseX = null;
        this.currentMouseY = null;
        
        // プレイヤーの行動後、他のボールが動いていなければCPUの行動をスケジュール
        if (!this.isAnyBallMoving()) {
            // ランダムな待機時間を設定
            const waitTime = 1000 + Math.random() * 1000; // 1〜2秒のランダムな待機時間
            setTimeout(() => {
                if (!this.gameOver && !this.isAnyBallMoving() && !this.isDragging && !this.cpuActionScheduled) {
                    this.cpuActionScheduled = true;
                    this.forceCPUAction();
                }
            }, waitTime);
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
        // 実際に動いているボールの数をカウント（デバッグ用）
        const movingBalls = [...this.playerBalls, ...this.cpuBalls].filter(ball => ball.isMoving);
        if (this.debugMode && movingBalls.length > 0) {
            console.log(`動いているボール: ${movingBalls.length}個`);
        }
        
        // 動いているボールがあるかどうかを返す
        return movingBalls.length > 0;
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
        if (playerRemaining === 0 || cpuRemaining === 0) {
            this.gameOver = true;
            console.log("ゲーム終了");
            // アラートは表示しない
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
    }
    
    /**
     * ゲームを描画する
     */
    draw() {
        // キャンバスをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // フィールドの背景を描画
        this.ctx.fillStyle = 'rgba(20, 30, 48, 0.7)'; // プレイヤー側
        this.ctx.fillRect(0, 0, this.canvas.width / 2, this.canvas.height);
        this.ctx.fillStyle = 'rgba(36, 59, 85, 0.7)'; // CPU側
        this.ctx.fillRect(this.canvas.width / 2, 0, this.canvas.width / 2, this.canvas.height);
        
        // グリッドパターンを描画
        this.drawGrid();
        
        // 中央線を描画
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // 穴の周りに光るエフェクトを描画
        this.drawHoleGlow();
        
        // ボールを描画
        [...this.playerBalls, ...this.cpuBalls].forEach(ball => {
            // すべてのボールを表示
            ball.draw(this.ctx);
            
            // 動いているボールには軌跡エフェクトを追加
            if (ball.isMoving) {
                this.drawBallTrail(ball);
            }
        });
        
        // 壁を描画（ボールの上に表示）
        this.wall.draw(this.ctx);
        
        // 穴を描画
        this.hole.draw(this.ctx);
        
        // ゲーム終了時のみメッセージを表示
        if (this.gameOver) {
            this.drawGameOverMessage();
        }
        
        // ドラッグ中の矢印を描画（最後に描画して他の要素に上書きされないようにする）
        if (this.isDragging && this.currentBall && this.currentMouseX && this.currentMouseY) {
            this.drawArrow();
        }
    }
    
    /**
     * グリッドパターンを描画
     */
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        
        // 縦線
        for (let x = 0; x <= this.canvas.width; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 横線
        for (let y = 0; y <= this.canvas.height; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    /**
     * 穴の周りに光るエフェクトを描画
     */
    drawHoleGlow() {
        const gradient = this.ctx.createRadialGradient(
            this.hole.x, this.hole.y, this.hole.radius,
            this.hole.x, this.hole.y, this.hole.radius * 3
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(this.hole.x, this.hole.y, this.hole.radius * 3, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    /**
     * ボールの軌跡エフェクトを描画
     */
    drawBallTrail(ball) {
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const trailLength = Math.min(speed * 0.8, 20);
        
        const gradient = this.ctx.createLinearGradient(
            ball.x, ball.y,
            ball.x - ball.vx * trailLength / speed, ball.y - ball.vy * trailLength / speed
        );
        
        const color = ball.isPlayer ? 'rgba(79, 195, 247, ' : 'rgba(255, 138, 101, ';
        gradient.addColorStop(0, color + '0.7)');
        gradient.addColorStop(1, color + '0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    /**
     * ゲーム終了メッセージを描画
     */
    drawGameOverMessage() {
        // 半透明の背景
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 勝者を判定
        const playerRemaining = this.playerBalls.filter(ball => !ball.scored).length;
        const cpuRemaining = this.cpuBalls.filter(ball => !ball.scored).length;
        const winner = playerRemaining === 0 ? 'プレイヤー' : 'CPU';
        
        // メッセージを表示
        this.ctx.font = 'bold 36px Poppins, sans-serif';
        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`${winner}の勝利！`, this.canvas.width / 2, this.canvas.height / 2 - 20);
        
        this.ctx.font = '20px Poppins, sans-serif';
        this.ctx.fillText('リスタートボタンをクリックして再開', this.canvas.width / 2, this.canvas.height / 2 + 30);
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
        
        // グラデーションを作成
        const gradient = this.ctx.createLinearGradient(
            this.startX, this.startY,
            arrowEndX, arrowEndY
        );
        gradient.addColorStop(0, 'rgba(79, 195, 247, 0.9)');
        gradient.addColorStop(1, 'rgba(79, 195, 247, 0.3)');
        
        this.ctx.strokeStyle = gradient;
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
        this.ctx.fillStyle = 'rgba(79, 195, 247, 0.8)';
        this.ctx.fill();
        
        // 強さのインジケーターを表示
        const powerPercent = Math.min(distance / 150 * 100, 100).toFixed(0);
        
        // 光るエフェクト付きのテキスト
        this.ctx.font = 'bold 18px Poppins, sans-serif';
        this.ctx.textAlign = 'center';
        
        // テキストの影
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillText(`${powerPercent}%`, arrowEndX + 2, arrowEndY - 18);
        
        // メインのテキスト
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(`${powerPercent}%`, arrowEndX, arrowEndY - 20);
        
        // 光るエフェクト
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillText(`${powerPercent}%`, arrowEndX, arrowEndY - 20);
    }
    
    /**
     * ゲームループ
     */
    gameLoop() {
        this.update();
        this.draw();
        
        // ボールが停止している場合はCPUの行動を実行（自由行動モード）
        if (!this.isAnyBallMoving() && !this.cpuActionScheduled && !this.gameOver && !this.isDragging) {
            console.log("ボールが停止しているためCPUの行動を実行");
            this.cpuActionScheduled = true;
            
            // より短い遅延でCPUの行動を実行（積極的に）
            setTimeout(() => {
                this.forceCPUAction();
            }, 500); // 1000msから500msに短縮
        }
        
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    /**
     * CPUの行動を強制的に実行する（スケジューリングをバイパス）
     */
    forceCPUAction() {
        console.log("CPUの行動を実行");
        
        // プレイヤーがドラッグ中の場合は何もしない
        if (this.isDragging) {
            this.cpuActionScheduled = false;
            return;
        }
        
        // 動かせるCPUのボールを探す
        const availableBalls = this.cpuBalls.filter(ball => !ball.scored && !ball.isMoving);
        console.log("動かせるCPUのボール数:", availableBalls.length);
        
        if (availableBalls.length === 0) {
            console.log("動かせるCPUのボールがありません");
            this.cpuActionScheduled = false;
            return;
        }
        
        // 戦略的なボール選択（最も穴に近いボールを優先）
        availableBalls.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(this.hole.x - a.x, 2) + Math.pow(this.hole.y - a.y, 2));
            const distB = Math.sqrt(Math.pow(this.hole.x - b.x, 2) + Math.pow(this.hole.y - b.y, 2));
            return distA - distB; // 距離が近い順にソート
        });
        
        // 80%の確率で最も穴に近いボールを選択、20%の確率でランダム選択
        let targetBall;
        if (Math.random() < 0.8) {
            targetBall = availableBalls[0]; // 最も穴に近いボール
        } else {
            const randomIndex = Math.floor(Math.random() * availableBalls.length);
            targetBall = availableBalls[randomIndex];
        }
        
        console.log("選択されたCPUボール:", targetBall);
        
        // 穴を狙う
        const targetX = this.hole.x;
        const targetY = this.hole.y;
        
        // 目標に向かって発射
        const dx = targetX - targetBall.x;
        const dy = targetY - targetBall.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 速度を設定（常に最高威力で発射）
        const speed = 35; // 最大威力
        const angleVariation = (Math.random() - 0.5) * 0.08; // わずかなランダム性（精度を上げる）
        
        // 角度にわずかなランダム性を加える
        const angle = Math.atan2(dy, dx) + angleVariation;
        targetBall.vx = Math.cos(angle) * speed;
        targetBall.vy = Math.sin(angle) * speed;
        targetBall.isMoving = true;
        
        console.log("CPUボールに最大速度を設定:", targetBall.vx, targetBall.vy);
        
        // ボールが停止するまで待つ
        const checkBallsStopped = () => {
            if (!this.isAnyBallMoving() && !this.isDragging) {
                console.log("CPUの行動完了、次のアクションのためにフラグをリセット");
                this.cpuActionScheduled = false;
            } else {
                // まだボールが動いている場合は再チェック
                setTimeout(checkBallsStopped, 500);
            }
        };
        
        // 一定時間後にボールの停止をチェック開始
        setTimeout(checkBallsStopped, 1000);
    }
}

// ページ読み込み時にゲームを開始
window.addEventListener('load', () => {
    new Game();
});
