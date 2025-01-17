
#pragma glslify: random = require(glsl-random)
#pragma glslify: snoise3 = require(glsl-noise/simplex/3d)

uniform int mode, movement;
uniform float throttle;
uniform float speed, time, dt;

uniform highp sampler2D textureStreet;
uniform vec4 streetTexelSize;

uniform vec2 gatherPosition;
uniform vec2 direction;

const vec3 minVel = vec3(-1, -1, -1);
const vec3 maxVel = vec3(1, 1, 1);

vec2 limit_vel(vec2 vel) {
    vel.x = clamp(vel.x, minVel.x, maxVel.x);
    vel.y = clamp(vel.y, minVel.y, maxVel.y);
    return vel;
}

vec3 repel(vec2 uv, vec3 pos) {
    const float threshold = 0.002;

    vec3 v = vec3(0, 0, 0);

    for(float y = 0.0; y < 1.0; y += resolutionTexelSize.y) {
        for(float x = 0.0; x < 1.0; x += resolutionTexelSize.x) {
            vec3 other = texture2D(texturePosition, vec2(x, y)).xyz;
            vec2 dir = (pos.xy - other.xy);
            float dist = length(dir);
            if(0.00001 < dist && dist < threshold) {
                v.xy += dir;
            }
        }
    }

    return v;
}

vec3 sample_street(float t, float p) {
    float y = (mod(floor(p * streetTexelSize.w), streetTexelSize.w) + 0.5) * streetTexelSize.z;
    float ratio = texture2D(textureStreet, vec2(0.0, y)).w;
    // float ratio = 1.0;
    return texture2D(textureStreet, vec2(mod(t * ratio, 1.0), y)).xyz;
}

float get_decay(vec2 uv) {
    return random(uv * 10.0) * 0.05 + 0.94;
}

vec4 street_velocity(vec2 uv, vec4 pos, vec4 vel) {
    float decay = get_decay(uv);
    vec3 to = sample_street(time * 0.25 * decay, pos.w);

    // offset
    to.xy += vec2(
        random(uv), random(uv.yx)
    ) * 0.005;

    vec3 dir = to.xyz - pos.xyz;

    float mag = length(dir);
    const float threshold = 0.005;

    if(mag > threshold) {
        vel.xyz += normalize(dir) * clamp(mag, 0.0, 0.001) * speed;
    }

    return vel;
}

vec4 gather_velocity(vec2 uv, vec4 pos, vec4 vel) {
    vec2 dir = (gatherPosition - pos.xy);
    float mag = length(dir);
    float threshold = 0.005 + random(uv) * 0.1; // distance

    if(mag > threshold) {
        vel.xy += normalize(dir) * clamp(mag, 0.0, 0.001) * speed;
    } else {
        vel.xyz *= 0.8;
    }
    vel.z -= pos.z * 0.1;

    return vel;
}

vec4 matrix_velocity(vec2 uv, vec4 pos, vec4 vel) {
    vec3 dir = (vec3(uv, 0) - pos.xyz);
    float mag = length(dir);
    const float threshold = 0.005; // distance
    if(mag > threshold) {
        vel.xyz += normalize(dir) * clamp(mag, 0.0, 0.001) * speed;
    } else {
        vel.xyz *= 0.8;
    }

    return vel;
}

vec4 direction_velocity(vec2 uv, vec4 pos, vec4 vel) {
    vec3 dir = vec3(direction.xy, 0.0);
    float mag = length(dir);
    const float threshold = 0.005;
    if(mag > threshold) {
        vel.xyz += normalize(dir) * clamp(mag, 0.0, 0.01);
    }

    return vel;
}

void init() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
}

void update() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);

    float decay = get_decay(uv);
    vel.xyz *= decay;

    if(movement == 1) {
        vel = gather_velocity(uv, pos, vel);
    } else if(movement == 2) {
        vel = matrix_velocity(uv, pos, vel);
        vel.xyz += repel(uv, pos.xyz);
    } else if(movement == 3) {
        vel = direction_velocity(uv, pos, vel);
        vel.xyz += repel(uv, pos.xyz);
    } else if(movement == 5) {
        vel.xyz += repel(uv, pos.xyz);
    } else {
        vel = street_velocity(uv, pos, vel);
        vel.xyz += repel(uv, pos.xyz) * 0.25;
    }
    vel.xy = limit_vel(vel.xy);

    if(uv.x <= throttle) {
        vel.w = min(vel.w + dt, 1.0);
    } else {
        vel.w = max(vel.w - dt, 0.0);
    }

    gl_FragColor = vel;
}

void main() {
    if(mode == 0) {
        init();
    } else {
        update();
    }
}
