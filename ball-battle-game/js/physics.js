/**
 * 物理エンジンクラス
 * ボールの動きや衝突判定を処理する
 */
class PhysicsEngine {
    constructor() {
        this.gravity = 0.3; // 擬似重力（傾斜効果用）- 中央をピークとする傾斜（値を大きくして傾斜を強く）
        this.friction = 0.96; // 摩擦係数（調整）
        this.restitution = 0.65; // 反発係数（調整）
        
        // 境界での衝突回数をカウント
        this.bounceCounters = new Map();
        
        // 最後に停止したボールの時間を記録
        this.lastStopTime = Date.now();
        
        // 安全装置：すべてのボールの動作時間を監視
        this.movementTimer = null;
    }

    /**
     * ボールの移動を更新する
     * @param {Ball} ball - 更新するボールオブジェクト
     * @param {Object} boundaries - フィールドの境界
     * @param {Wall} wall - 中央の壁
     * @param {Hole} hole - 中央の穴
     */
    updateBall(ball, boundaries, wall, hole) {
        // 動いていない場合は計算しない
        if (!ball.isMoving) return;

        // 位置を速度に基づいて更新
        ball.x += ball.vx;
        ball.y += ball.vy;

        // 擬似傾斜効果（中央をピークとする傾斜 - 穴を外した場合、自陣側に戻る傾向がある）
        // 中央からの距離に比例して傾斜効果を強くする
        const centerX = boundaries.width / 2;
        const distanceFromCenter = Math.abs(ball.x - centerX);
        const slopeEffect = this.gravity * (1 + distanceFromCenter / centerX); // 中央から離れるほど傾斜効果が強くなる
        
        // プレイヤーとCPUで同じ傾斜効果を適用（中央から離れると自陣側に戻る傾向）
        if (ball.x < centerX) {
            // プレイヤー側 - 中央から離れると左に引っ張られる
            ball.vx -= slopeEffect;
        } else {
            // CPU側 - 中央から離れると右に引っ張られる
            ball.vx += slopeEffect;
        }

        // 摩擦による減速
        ball.vx *= this.friction;
        ball.vy *= this.friction;

        // 速度が非常に小さくなったら停止とみなす
        const speedThreshold = 0.3; // 閾値を上げる
        const totalSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        
        // 動作時間が長すぎる場合も強制停止（安全装置）
        if (!ball.startMoveTime) {
            ball.startMoveTime = Date.now();
        }
        const moveTime = Date.now() - ball.startMoveTime;
        
        if (totalSpeed < speedThreshold || moveTime > 10000) { // 10秒以上動いていたら強制停止
            ball.vx = 0;
            ball.vy = 0;
            ball.isMoving = false;
            ball.startMoveTime = null; // リセット
            this.lastStopTime = Date.now(); // 停止時間を記録
            console.log("ボールが停止:", ball);
        }

        // 壁との衝突判定
        this.checkWallCollision(ball, wall, hole);

        // フィールド境界との衝突判定
        this.checkBoundaryCollision(ball, boundaries);
    }

    /**
     * 壁との衝突判定
     * @param {Ball} ball - ボールオブジェクト
     * @param {Wall} wall - 壁オブジェクト
     * @param {Hole} hole - 穴オブジェクト
     */
    checkWallCollision(ball, wall, hole) {
        // 壁の範囲内にあるかチェック
        if (ball.y >= wall.y - wall.height / 2 && ball.y <= wall.y + wall.height / 2) {
            // 穴の範囲内にあるかチェック
            if (Math.abs(ball.y - hole.y) <= hole.radius) {
                // 穴の範囲内なら衝突判定をスキップ
                return;
            }

            // 壁の左側との衝突
            if (ball.x + ball.radius > wall.x - wall.width / 2 && ball.x < wall.x) {
                ball.x = wall.x - wall.width / 2 - ball.radius;
                ball.vx = -ball.vx * this.restitution;
            }
            // 壁の右側との衝突
            else if (ball.x - ball.radius < wall.x + wall.width / 2 && ball.x > wall.x) {
                ball.x = wall.x + wall.width / 2 + ball.radius;
                ball.vx = -ball.vx * this.restitution;
            }
        }
    }

    /**
     * フィールド境界との衝突判定
     * @param {Ball} ball - ボールオブジェクト
     * @param {Object} boundaries - フィールドの境界
     */
    checkBoundaryCollision(ball, boundaries) {
        let collision = false;
        
        // ボールのIDを取得（なければ作成）
        const ballId = ball.id || `ball_${Math.random().toString(36).substr(2, 9)}`;
        ball.id = ballId;
        
        // このボールの衝突カウンターを取得または初期化
        if (!this.bounceCounters.has(ballId)) {
            this.bounceCounters.set(ballId, 0);
        }
        
        // 左右の境界
        if (ball.x - ball.radius < 0) {
            ball.x = ball.radius + 3; // 内側に押し出す
            ball.vx = -ball.vx * this.restitution * 0.7; // 反発係数を小さくする
            collision = true;
            this.bounceCounters.set(ballId, this.bounceCounters.get(ballId) + 1);
        } else if (ball.x + ball.radius > boundaries.width) {
            ball.x = boundaries.width - ball.radius - 3; // 内側に押し出す
            ball.vx = -ball.vx * this.restitution * 0.7; // 反発係数を小さくする
            collision = true;
            this.bounceCounters.set(ballId, this.bounceCounters.get(ballId) + 1);
        }

        // 上下の境界
        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius + 3; // 内側に押し出す
            ball.vy = -ball.vy * this.restitution * 0.7; // 反発係数を小さくする
            collision = true;
            this.bounceCounters.set(ballId, this.bounceCounters.get(ballId) + 1);
        } else if (ball.y + ball.radius > boundaries.height) {
            ball.y = boundaries.height - ball.radius - 3; // 内側に押し出す
            ball.vy = -ball.vy * this.restitution * 0.7; // 反発係数を小さくする
            collision = true;
            this.bounceCounters.set(ballId, this.bounceCounters.get(ballId) + 1);
        }
        
        // 衝突が発生した場合の処理
        if (collision) {
            const bounceCount = this.bounceCounters.get(ballId);
            const totalSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            
            // 速度が小さい、または連続衝突回数が多い場合は強制停止
            if (totalSpeed < 1.0 || bounceCount >= 4) {
                ball.vx = 0;
                ball.vy = 0;
                ball.isMoving = false;
                this.bounceCounters.set(ballId, 0); // カウンターをリセット
                console.log("境界衝突で停止:", ball);
            }
            // 速度が大きくても、連続衝突が2回以上なら減速を強める
            else if (bounceCount >= 2) {
                ball.vx *= 0.7;
                ball.vy *= 0.7;
            }
        } else {
            // 衝突していない場合はカウンターをリセット
            this.bounceCounters.set(ballId, 0);
        }
    }

    /**
     * ボール同士の衝突判定と応答
     * @param {Ball} ball1 - 1つ目のボール
     * @param {Ball} ball2 - 2つ目のボール
     */
    checkBallCollision(ball1, ball2) {
        const dx = ball2.x - ball1.x;
        const dy = ball2.y - ball1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = ball1.radius + ball2.radius;

        // 衝突判定
        if (distance < minDistance) {
            // 衝突応答（運動量保存則に基づく計算）
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            // ボール1の位置と速度を回転
            const pos1 = {x: 0, y: 0};
            const vel1 = {
                x: ball1.vx * cos + ball1.vy * sin,
                y: ball1.vy * cos - ball1.vx * sin
            };

            // ボール2の位置と速度を回転
            const pos2 = {
                x: dx * cos + dy * sin,
                y: dy * cos - dx * sin
            };
            const vel2 = {
                x: ball2.vx * cos + ball2.vy * sin,
                y: ball2.vy * cos - ball2.vx * sin
            };

            // 衝突後の速度を計算（1次元の弾性衝突）
            const vxTotal = vel1.x - vel2.x;
            vel1.x = ((ball1.mass - ball2.mass) * vel1.x + 2 * ball2.mass * vel2.x) / (ball1.mass + ball2.mass);
            vel2.x = vxTotal + vel1.x;

            // 位置を更新して重なりを解消（重なりを確実に解消するため係数を大きくする）
            const overlap = (minDistance - distance) * 1.01; // 少し余分に離す
            const moveRatio1 = ball1.radius / minDistance;
            const moveRatio2 = ball2.radius / minDistance;
            
            const moveX = overlap * cos;
            const moveY = overlap * sin;
            
            ball1.x -= moveX * moveRatio2;
            ball1.y -= moveY * moveRatio2;
            ball2.x += moveX * moveRatio1;
            ball2.y += moveY * moveRatio1;

            // 速度を回転して戻す
            ball1.vx = vel1.x * cos - vel1.y * sin;
            ball1.vy = vel1.y * cos + vel1.x * sin;
            ball2.vx = vel2.x * cos - vel2.y * sin;
            ball2.vy = vel2.y * cos + vel2.x * sin;

            // 反発係数を適用
            ball1.vx *= this.restitution;
            ball1.vy *= this.restitution;
            ball2.vx *= this.restitution;
            ball2.vy *= this.restitution;

            // 両方のボールを動いている状態にする
            ball1.isMoving = true;
            ball2.isMoving = true;
            
            // 速度が非常に小さい場合は少し加速して、くっつきを防止
            const minVelocity = 0.2;
            if (Math.abs(ball1.vx) < minVelocity && Math.abs(ball1.vy) < minVelocity) {
                const randomAngle = Math.random() * Math.PI * 2;
                ball1.vx += Math.cos(randomAngle) * 0.3;
                ball1.vy += Math.sin(randomAngle) * 0.3;
            }
            
            if (Math.abs(ball2.vx) < minVelocity && Math.abs(ball2.vy) < minVelocity) {
                const randomAngle = Math.random() * Math.PI * 2;
                ball2.vx += Math.cos(randomAngle) * 0.3;
                ball2.vy += Math.sin(randomAngle) * 0.3;
            }
        }
    }
}
