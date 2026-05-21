shader_type spatial;
render_mode blend_mix, diffuse_burley, specular_schlick_ggx, unshaded;

uniform float fresnel_thickness = 3.0;
uniform sampler2D texture_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D background_texture: source_color;

uniform vec2 window_size = vec2(1920, 1080);

float fresnel(float amount, vec3 normal, vec3 view) {
	return pow((1.0 - clamp(dot(normalize(normal), normalize(view)), 0.0, 1.0 )), amount);
}

void fragment() {
	vec2 uv = SCREEN_UV * VIEWPORT_SIZE / window_size;
	vec4 background = texture(background_texture, uv);
	vec4 albedo_tex = texture(texture_albedo, UV);

	float mix_value = albedo_tex.a * (1.0 - albedo_tex.b * fresnel(fresnel_thickness, NORMAL, VIEW));

	ALBEDO = mix(background.rgb, albedo_tex.rgb, mix_value);
}
