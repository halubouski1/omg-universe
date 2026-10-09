// ========================================
// Moon — WebGL globe with hotspots pinned to its surface
// ========================================
// The globe is textured with NASA's LRO colour map of the whole Moon
// (moon-map.jpg, equirectangular, CGI Moon Kit — public domain), so it can
// spin a full turn. It turns on its own and can be dragged; the map is
// graded in the shader into the cool, high-contrast look of the design.

const MOON_MOTION = {
  autoSpeed: 0.1, // radians per second (~60s per turn)
  restPitch: 0.12, // slight tilt towards the viewer at rest
  maxPitch: 0.7,
  dragSpeed: 0.005, // radians per dragged pixel
  pitchReturn: 1.5, // how quickly a dragged tilt eases back to rest
  inertiaDecay: 3, // how quickly a flick slows down
};

const MOON_VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const MOON_FRAGMENT_SHADER = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform mat3 uInverseRotation;
  uniform float uEdge; // one device pixel, for an anti-aliased rim

  const float PI = 3.14159265;
  const vec3 SHADOW_TINT = vec3(0.08, 0.12, 0.17); // ~ design maria #1d2a37
  const vec3 LIGHT_TINT = vec3(0.86, 0.93, 1.0);

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float alpha = 1.0 - smoothstep(1.0 - uEdge, 1.0, r);
    if (alpha <= 0.0) discard;

    // View-space normal -> point on the Moon -> longitude/latitude -> map
    float z = sqrt(max(0.0, 1.0 - r * r));
    vec3 surface = uInverseRotation * vec3(p, z);
    vec2 uv = vec2(
      0.5 + atan(surface.x, surface.z) / (2.0 * PI),
      0.5 - asin(clamp(surface.y, -1.0, 1.0)) / PI
    );
    vec3 map = texture2D(uTexture, uv).rgb;

    // Grade: stretch the map's grey range (~0.30-0.76) and tint it from
    // blue-black maria to icy highlands
    float luma = dot(map, vec3(0.299, 0.587, 0.114));
    float level = clamp((luma - 0.30) / 0.46, 0.0, 1.0);
    vec3 color = mix(SHADOW_TINT, LIGHT_TINT, pow(level, 1.3));

    // Limb darkening for the curvature
    float shade = 0.5 + 0.5 * pow(z, 0.6);
    gl_FragColor = vec4(color * shade * alpha, alpha);
  }
`;

// R = Rx(pitch) * Ry(yaw), rows listed
const getRotation = (yaw, pitch) => {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  return [
    [cy, 0, sy],
    [sx * sy, cx, -sx * cy],
    [-cx * sy, sx, cx * cy],
  ];
};

const applyRotation = (m, [x, y, z]) => [
  m[0][0] * x + m[0][1] * y + m[0][2] * z,
  m[1][0] * x + m[1][1] * y + m[1][2] * z,
  m[2][0] * x + m[2][1] * y + m[2][2] * z,
];

// Inverse of a rotation is its transpose; WebGL wants it column-major, and
// the transpose's columns are R's rows
const toInverseUniform = (m) => new Float32Array([...m[0], ...m[1], ...m[2]]);

const createMoonRenderer = (canvas, image) => {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: true });
  if (!gl) return null;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };

  const vertex = compile(gl.VERTEX_SHADER, MOON_VERTEX_SHADER);
  const fragment = compile(gl.FRAGMENT_SHADER, MOON_FRAGMENT_SHADER);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  // No mipmaps: the longitude wrap would show a 1px seam line with them,
  // and at this size the map is drawn close to 1:1 anyway
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  try {
    // Throws for a cross-origin image (e.g. the page opened via file://)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  } catch {
    return null;
  }

  const uniforms = {
    rotation: gl.getUniformLocation(program, 'uInverseRotation'),
    edge: gl.getUniformLocation(program, 'uEdge'),
  };
  gl.clearColor(0, 0, 0, 0);

  return {
    resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uniforms.edge, 2 / canvas.width);
    },
    draw(rotation) {
      gl.uniformMatrix3fv(uniforms.rotation, false, toInverseUniform(rotation));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
};

const initMoon = (globe) => {
  const section = globe.closest('.moon');
  const canvas = globe.querySelector('.moon__canvas');
  // Each spot sits at a latitude/longitude on the Moon (degrees; longitude 0
  // faces the viewer at the start), so it turns with the surface
  const spots = [...globe.querySelectorAll('.moon__spot')].map((el) => {
    const lat = (parseFloat(el.dataset.lat) * Math.PI) / 180;
    const lon = (parseFloat(el.dataset.lon) * Math.PI) / 180;
    return {
      el,
      point: [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)],
    };
  });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer = null;
  let yaw = 0;
  let pitch = MOON_MOTION.restPitch;
  let yawVelocity = 0;
  let drag = null;
  let lastFrame = null;
  let isVisible = false;
  let hoverCount = 0;

  const placeSpots = (rotation) => {
    const radius = globe.clientWidth / 2;
    spots.forEach(({ el, point }) => {
      const [x, y, z] = applyRotation(rotation, point);
      // Fade out as the spot turns over the rim; shrink slightly with depth
      const opacity = Math.min(Math.max((z + 0.02) / 0.14, 0), 1);
      const scale = 0.75 + 0.25 * Math.max(z, 0);
      // Only the dot shrinks with depth; the video card keeps its full size
      el.style.transform = `translate(${x * radius}px, ${-y * radius}px)`;
      // The same offset for CSS: on small screens the card cancels it to sit
      // centred on the globe instead of beside the dot
      el.style.setProperty('--spot-x', `${(x * radius).toFixed(1)}px`);
      el.style.setProperty('--spot-y', `${(-y * radius).toFixed(1)}px`);
      el.style.setProperty('--spot-scale', scale.toFixed(3));
      el.style.opacity = opacity.toFixed(3);
      el.classList.toggle('is-hidden', opacity < 0.5);
      el.classList.toggle('is-left', x < 0);
      // Cards open upwards unless the dot is near the top, where a 440px card
      // opening upwards would run off the globe
      el.classList.toggle('is-low', y < 0.45);
    });
  };

  const render = () => {
    const rotation = getRotation(yaw, pitch);
    renderer?.draw(rotation);
    placeSpots(rotation);
  };

  // Spins on its own while on screen; stops while a hotspot is hovered (so
  // an open video card stays under the cursor) and while being dragged
  const update = (dt) => {
    if (drag) return;
    const isHeld = hoverCount > 0;
    if (!isHeld && !prefersReducedMotion) yaw += MOON_MOTION.autoSpeed * dt;
    yaw += yawVelocity * dt;
    yawVelocity *= Math.exp(-MOON_MOTION.inertiaDecay * dt);
    pitch += (MOON_MOTION.restPitch - pitch) * (1 - Math.exp(-MOON_MOTION.pitchReturn * dt));
  };

  const tick = (now) => {
    if (!isVisible) {
      lastFrame = null;
      return;
    }
    if (lastFrame !== null) update(Math.min((now - lastFrame) / 1000, 0.1));
    lastFrame = now;
    render();
    requestAnimationFrame(tick);
  };

  new IntersectionObserver(([entry]) => {
    const wasVisible = isVisible;
    isVisible = entry.isIntersecting;
    if (isVisible && !wasVisible) requestAnimationFrame(tick);
  }).observe(globe);

  const image = new Image();
  image.addEventListener('load', () => {
    renderer = createMoonRenderer(canvas, image);
    if (!renderer) return; // the <img> fallback stays visible
    section.classList.add('has-webgl');
    renderer.resize();
    render();
  });
  image.src = globe.dataset.moonMap;

  window.addEventListener('resize', () => {
    renderer?.resize();
    render();
  });

  // Drag to turn: horizontal spins, vertical tilts; a flick keeps spinning
  canvas.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, y: event.clientY, time: event.timeStamp, velocity: 0 };
    canvas.setPointerCapture(event.pointerId);
    section.classList.add('is-dragging');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const dt = Math.max((event.timeStamp - drag.time) / 1000, 1 / 120);
    yaw += dx * MOON_MOTION.dragSpeed;
    pitch = Math.min(Math.max(pitch + dy * MOON_MOTION.dragSpeed, -MOON_MOTION.maxPitch), MOON_MOTION.maxPitch);
    drag = { x: event.clientX, y: event.clientY, time: event.timeStamp, velocity: (dx * MOON_MOTION.dragSpeed) / dt };
  });

  const endDrag = () => {
    if (!drag) return;
    yawVelocity = drag.velocity;
    drag = null;
    section.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Hotspots: pause the globe while a card is open, play/pause its video
  spots.forEach(({ el }) => {
    const video = el.querySelector('.moon__video');
    const play = el.querySelector('.moon__play');

    const stopVideo = () => {
      video.pause();
      el.classList.remove('is-playing');
    };

    el.addEventListener('pointerenter', () => { hoverCount += 1; });
    el.addEventListener('pointerleave', () => {
      hoverCount = Math.max(hoverCount - 1, 0);
      stopVideo();
    });
    el.addEventListener('focusin', (event) => {
      if (!el.contains(event.relatedTarget)) hoverCount += 1;
    });
    el.addEventListener('focusout', (event) => {
      if (el.contains(event.relatedTarget)) return;
      hoverCount = Math.max(hoverCount - 1, 0);
      stopVideo();
    });

    play.addEventListener('click', () => {
      video.muted = false;
      video.play();
      el.classList.add('is-playing');
    });
    video.addEventListener('click', stopVideo);
  });
};

document.querySelectorAll('[data-moon]').forEach(initMoon);
