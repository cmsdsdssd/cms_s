{
  "model": "nanobanana-pro",
  "mode": "image_to_image_product_retouch",
  "input": {
    "image": "{{INPUT_IMAGE}}",
    "notes": {
      "subject": "Jewelry item (necklace, ring, earring, bracelet, pendant, etc.)",
      "composition_change_allowed": true,
      "strict_no_deformation": true
    }
  },

  "goal": {
    "primary": "주얼리의 구도와 배치는 자연스럽게 변경하되, 제품 형태는 100% 보존하며 따뜻하고 고급스러운 스튜디오 분위기 연출",
    "secondary": [
      "AI 특유의 형태 뭉개짐, 임의의 디테일 추가/삭제 절대 차단 (형태 보존 최우선)",
      "배경을 따뜻하고 깨끗한 아이보리 톤(#FDFBF7)으로 균일화",
      "차가운 느낌을 배제하고 부드럽고 고급스러운 조명감 부여"
    ]
  },

  "prompt": [
    "Professional high-end studio product photography, premium jewelry e-commerce hero shot with a warm atmosphere.",
    "CAMERA & COMPOSITION: The layout, pose, or camera angle can be adjusted for a more flattering natural presentation. Generous clean negative space.",
    "SUBJECT: A beautiful piece of jewelry lying naturally, showing realistic weight and drape.",
    "BACKGROUND: Seamless warm ivory matte studio sweep (hex code #FDFBF7). Smooth, clean, and perfectly uniform. Not sterile white. Authentic, gentle warm contact shadow beneath the jewelry.",
    "LIGHTING: Soft, warm diffused studio lighting. High-key but creamy. Controlled warm specular highlights on metal and stones to reveal form and sparkle without harshness.",
    "REFLECTION CONTROL: Clean, warm metallic reflections. Preserve true colors of gems and metal tones under warm light.",
    "RETOUCH (CRITICAL & NON-NEGOTIABLE): ZERO DEFORMATION. While the composition may change, the physical jewelry piece MUST remain completely untouched. Absolute 1:1 topological match with the original item. No AI hallucinations."
  ],

  "negative_prompt": [
    "cool tones, blue cast, sterile white background, harsh bright white, pure #FFFFFF background",
    "AI hallucinated details, structural deformation, missing prongs, extra stones, changed chain type, distorted geometry, melted metal",
    "altered product design, mismatched physical details from input",
    "hands, human, props, text, watermark",
    "stiff unnatural placement, floating object",
    "dirty background, uneven background color, harsh shadows"
  ],

  "constraints": {
    "structure_preservation": 0.85,
    "identity_preservation": {
      "keep_exact_object": true,
      "allow_repositioning_or_angle_change": true,
      "allow_design_alteration": false,
      "zero_tolerance_for_hallucination": true
    },
    "background_replacement": {
      "enabled": true,
      "color_hex": "#FDFBF7",
      "uniformity_target": "absolute_uniform",
      "keep_contact_shadow": {
        "enabled": true,
        "opacity_percent": 15,
        "softness": "natural_soft",
        "distance_px": 15,
        "color_tint": "warm_grey"
      }
    }
  },

  "camera": {
    "angle": "flattering_product_angle_flexible",
    "framing": "centered_product_75pct",
    "lens_look": "macro_100mm_equivalent",
    "aperture_simulation": "f/11_focus_stacked",
    "white_balance_shift": "slightly_warm"
  },

  "lighting": {
    "style": "soft_warm_jewelry_studio",
    "highlight_control": {
      "reduce_hotspots": true,
      "keep_clean_specular_edges": true,
      "highlight_warmth": "creamy"
    }
  },

  "retouching": {
    "tone_color": {
      "neutralize_color_cast": false,
      "target_atmosphere": "warm_and_clean",
      "whites_to_hex": "#FDFBF7"
    },
    "detail": {
      "microcontrast": "subtle_plus",
      "sharpening": "clean_crisp_no_halo",
      "noise_reduction": "low_to_preserve_texture"
    }
  },

  "output": {
    "aspect_ratio": "4:3",
    "resolution_px": { "width": 3000, "height": 2250 },
    "format": "PNG",
    "background": "#FDFBF7"
  },

  "generation": {
    "sampler": "dpmpp_2m_karras",
    "steps": 45,
    "cfg_scale": 7.0,
    "denoise_strength": 0.45,
    "seed": -1
  },

  "quality_checks": [
    "CRITICAL: Zero deformation. Product physical structure is identical to input.",
    "Background is a uniform, clean warm ivory color (#FDFBF7), not pure white.",
    "Overall atmosphere is warm, luxurious, and clean.",
    "Jewelry is entirely in frame with natural warm shadows."
  ]
}