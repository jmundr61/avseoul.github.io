var blob_vert = 
`
uniform vec2 u_mouse;
uniform vec2 u_mouse_delta;
uniform float u_t;
uniform bool u_is_init;

uniform float u_audio_high;
uniform float u_audio_mid;
uniform float u_audio_bass;
uniform float u_audio_level;
uniform float u_audio_history;

varying float v_noise;




#if defined(IS_PBR) && defined(HAS_CUBEMAP)
	uniform mat4 u_view_matrix_inverse;
	
	varying vec3 v_world_normal;
	varying vec3 v_eye_pos;
	varying vec3 v_object_pos;
	varying vec3 v_pos;
	varying vec3 v_normal;
	varying vec3 v_world_pos;
	varying vec2 v_uv;
#endif



#if defined(HAS_SHADOW)
	uniform mat4 u_shadow_matrix;
	varying vec4 v_shadow_coord;

	const mat4 biasMat  = mat4(	0.5, 0.0, 0.0, 0.0,
							0.0, 0.5, 0.0, 0.0,
							0.0, 0.0, 0.5, 0.0,
							0.5, 0.5, 0.5, 1.0 );
#endif




float cal_noise(vec3 _uv, float _res){
	// original code from 
	// https://www.shadertoy.com/user/Trisomie21

	const vec3 s = vec3(1e0, 1e2, 1e4);
	
	_uv *= _res;
	
	vec3 uv0 = floor(mod(_uv, _res))*s;
	vec3 uv1 = floor(mod(_uv+vec3(1.), _res))*s;
	
	vec3 f = fract(_uv); f = f*f*(3.0-2.0*f);
	
	vec4 v = vec4(uv0.x+uv0.y+uv0.z, uv1.x+uv0.y+uv0.z,
		      	  uv0.x+uv1.y+uv0.z, uv1.x+uv1.y+uv0.z);
	
	vec4 r = fract(sin(v*1e-3)*1e5);
	float r0 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
	
	r = fract(sin((v + uv1.z - uv0.z)*1e-3)*1e5);
	float r1 = mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
	
	return mix(r0, r1, f.z);
}

vec3 norm(in vec3 _v){
	return length(_v) > .0 ? normalize(_v) : vec3(0.);
}

mat4 rotationMatrix(vec3 axis, float angle)
{
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

void main(){
	float m_bass = u_audio_bass;
	float m_mid = u_audio_mid;
	float m_high = u_audio_high;
	float m_level = u_audio_level;
	float m_history = u_audio_history;

	vec3 m_noise_seed = position.xyz;
	float m_noise_complexity = 1.;
	float m_noise_time = u_audio_history * .1;
	float m_noise_scale = .9 + m_bass;
    
    float m_fbm = 0.;

    const int m_noise_oct = 6;
    for(int i = 0; i < m_noise_oct; i++){
    	m_fbm += cal_noise(
    		m_noise_seed + m_noise_time * float(i),
    		m_noise_complexity * float(i)
    	);
    }
    m_fbm /= float(m_noise_oct);

    vec3 m_pos = position + normal * m_fbm * m_noise_scale;

	// get color 
    float m_noise_col = pow(1.-m_fbm, 3.5);
    v_noise = m_noise_col + m_noise_col * m_level * 2.2;     




#if defined(IS_WIRE) || defined(IS_POINTS)
	// size
	gl_PointSize = pow(m_fbm, 6.) * 1500. * m_high;
	
	// rand direction
	// m_pos += pow(m_fbm, 8.) * normal * 8.;
	vec3 _rand_point_dir = vec3(cal_noise(m_pos.zyx + m_noise_time, 10.), cal_noise(m_pos.yzx + m_noise_time, 10.), cal_noise(m_pos.zxy + m_noise_time, 10.));
	_rand_point_dir = 1.-2.*_rand_point_dir;
	m_pos += _rand_point_dir * .3 * m_level;
#endif

#if defined(IS_POP)
	m_pos *= 1.2 * m_fbm;
	m_pos = vec3(rotationMatrix(vec3(.2,1.,.3), .5*m_history) * vec4(m_pos, 1.));
#endif
#if defined(IS_POP_OUT)
	// gl_PointSize *= 2.;
	m_pos *= 1.2;

	m_pos -= _rand_point_dir*_rand_point_dir * .2 * (m_high);
	m_pos = vec3(rotationMatrix(vec3(1.,.2,.3), -.5*m_history) * vec4(m_pos, 1.));
#endif



#if defined(IS_PBR) && defined(HAS_CUBEMAP)
	vec4 _world_pos	= modelMatrix * vec4(m_pos, 1.);
    vec4 _view_pos	= viewMatrix * _world_pos;

    v_object_pos = m_pos;
    v_pos = _view_pos.xyz;
	v_normal = normalMatrix * normal; 
	v_world_pos = _world_pos.xyz;
	v_world_normal = vec3(u_view_matrix_inverse * vec4(v_normal, 0.));
	v_eye_pos = -1. * vec3(u_view_matrix_inverse * (_view_pos - vec4(0.,0.,0.,1.)) );
	v_uv = uv;
	
#endif

#if defined(HAS_SHADOW)
	v_shadow_coord = (biasMat * u_shadow_matrix) * vec4(m_pos, 1.);
#endif

	gl_Position = projectionMatrix * modelViewMatrix * vec4(m_pos, 1.);
}
`