/**
 * 物理エンジンクラス
 * ボールの動きや衝突判定を処理する
 */
class PhysicsEngine {
    constructor() {
        this.gravity = 0.1; // 擬似重力（傾斜効果用）- 中央をピークとする傾斜
        this.friction = 0.98; // 摩擦係数
        this.restitution = 0.8; // 反発係数
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
        if (ball.x < boundaries.width / 2) {
            // プレイヤー側 - 中央に向かって右に行くほど上り坂、中央から離れると下り坂
            ball.vx += this.gravity * (ball.isPlayer ? -1 : 1);
        } else {
            // CPU側 - 中央に向かって左に行くほど上り坂、中央から離れると下り坂
            ball.vx += this.gravity * (ball.isPlayer ? 1 : -1);
        }

        // 摩擦による減速
        ball.vx *= this.friction;
        ball.vy *= this.friction;

        // 速度が非常に小さくなったら停止とみなす
        if (Math.abs(ball.vx) < 0.05 && Math.abs(ball.vy) < 0.05) {
            ball.vx = 0;
            ball.vy = 0;
            ball.isMoving = false;
            console.log("ボールが停止:", ball);
        }

        // 壁との衝突判定
        this.checkWallCollision(ball, wall, hole);

        // フィールド境界との衝突判定
        this.checkBoundaryCollision(ball, boundaries);
    }

    /**
     * 中央の壁との衝突判定
     * @param {Ball} ball - ボールオブジェクト
     * @param {Wall} wall - 壁オブジェクト
     * @param {Hole} hole - 穴オブジェクト
     */
    checkWallCollision(ball, wall, hole) {
        // 穴との衝突判定（穴を通過できるかチェック）
        if (this.checkHoleCollision(ball, hole)) {
            return; // 穴を通過できる場合は壁との衝突判定をスキップ
        }

        // 壁との衝突判定
        if (Math.abs(ball.x - wall.x) < ball.radius) {
            // 壁の左右どちらかにボールがある場合
            if (ball.x < wall.x) {
                ball.x = wall.x - ball.radius;
            } else {
                ball.x = wall.x + ball.radius;
            }
            ball.vx = -ball.vx * this.restitution;
        }
    }

    /**
     * 穴との衝突判定（穴を通過できるかチェック）
     * @param {Ball} ball - ボールオブジェクト
     * @param {Hole} hole - 穴オブジェクト
     * @returns {boolean} - 穴を通過できる場合はtrue
     */
    checkHoleCollision(ball, hole) {
        // ボールの中心と穴の中心との距離を計算
        const dx = ball.x - hole.x;
        const dy = ball.y - hole.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // ボールが穴を通過できるかチェック（ボールの中心が穴の範囲内にあるか）
        return distance < hole.radius - ball.radius;
    }

    /**
     * フィールド境界との衝突判定
     * @param {Ball} ball - ボールオブジェクト
     * @param {Object} boundaries - フィールドの境界
     */
    checkBoundaryCollision(ball, boundaries) {
        // 左右の境界
        if (ball.x - ball.radius < 0) {
            ball.x = ball.radius;
            ball.vx = -ball.vx * this.restitution;
        } else if (ball.x + ball.radius > boundaries.width) {
            ball.x = boundaries.width - ball.radius;
            ball.vx = -ball.vx * this.restitution;
        }

        // 上下の境界
        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy = -ball.vy * this.restitution;
        } else if (ball.y + ball.radius > boundaries.height) {
            ball.y = boundaries.height - ball.radius;
            ball.vy = -ball.vy * this.restitution;
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

        // 衝突判定
        if (distance < ball1.radius + ball2.radius) {
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

            // 位置を更新して重なりを解消
            const absV = Math.abs(vel1.x) + Math.abs(vel2.x);
            const overlap = (ball1.radius + ball2.radius) - Math.abs(pos1.x - pos2.x);
            pos1.x -= vel1.x / absV * overlap;
            pos2.x -= vel2.x / absV * overlap;

            // 回転を元に戻す
            const pos1F = {
                x: pos1.x * cos - pos1.y * sin,
                y: pos1.y * cos + pos1.x * sin
            };
            const pos2F = {
                x: pos2.x * cos - pos2.y * sin,
                y: pos2.y * cos + pos2.x * sin
            };

            // ボール2の位置を更新
            ball2.x = ball1.x + pos2F.x;
            ball2.y = ball1.y + pos2F.y;
            ball1.x = ball1.x + pos1F.x;
            ball1.y = ball1.y + pos1F.y;

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
        }
    }
}
