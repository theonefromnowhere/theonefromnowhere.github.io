varying vec3 vDirection;

void main() {
  // The dome is centred on the camera, so the local position doubles as the
  // view direction.
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
