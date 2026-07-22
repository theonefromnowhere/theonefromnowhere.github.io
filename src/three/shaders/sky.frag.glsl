uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform float uBands;

varying vec3 vDirection;

void main() {
  float h = clamp(vDirection.y * 0.5 + 0.5, 0.0, 1.0);

  // Quantising the gradient is the point: a 15-bit framebuffer could not hold
  // a smooth sky, and the banding is half of what makes this read as PS1.
  float banded = floor(h * uBands) / uBands;
  // Keep a sliver of the smooth gradient so the bands do not look like steps
  // cut out of flat colour.
  h = mix(banded, h, 0.25);

  vec3 color = mix(uHorizon, uMid, smoothstep(0.42, 0.62, h));
  color = mix(color, uTop, smoothstep(0.58, 0.95, h));

  // A low warm glow just above the horizon — the setting sun, off-frame.
  float glow = pow(1.0 - abs(h - 0.47) * 5.5, 4.0);
  color += uGlow * clamp(glow, 0.0, 1.0) * 0.35;

  // Below the horizon line the sky darkens into the haze over the sea.
  color = mix(color * 0.55, color, smoothstep(0.34, 0.5, h));

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
