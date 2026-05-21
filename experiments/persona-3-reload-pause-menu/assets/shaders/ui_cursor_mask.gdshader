shader_type canvas_item;
render_mode blend_add;

const vec3 WHITE = vec3(1.0);
const vec3 RED = vec3(1.0, 0.0, 0.0);

uniform sampler2D text_viewport_texture: filter_nearest;

void fragment() {
	vec4 text = texture(text_viewport_texture, SCREEN_UV);

	if (text.b < 0.05) {
		COLOR.rgb = mix(COLOR.rgb, RED, text.a);
	} else {
		COLOR.rgb = mix(COLOR.rgb, WHITE, text.a);
	}
}