from PIL import Image, ImageDraw, ImageFont
import io
from django.core.files.base import ContentFile
import os
from django.conf import settings

def generate_social_card(user_name, event_name, poster_path=None):
    # Base: Formato Story (1080x1920)
    # If no poster is provided, we create a solid color background
    if poster_path and os.path.exists(poster_path):
        template = Image.open(poster_path).convert("RGBA").resize((1080, 1920))
    else:
        template = Image.new('RGBA', (1080, 1920), (25, 25, 25, 255))
    
    # Overlay oscuro/degradado para alto contraste de la tipografía
    overlay = Image.new('RGBA', template.size, (0, 0, 0, 140))
    card = Image.alpha_composite(template, overlay)
    
    draw = ImageDraw.Draw(card)
    
    # Fonts
    # Depending on OS, fonts might need to be downloaded or use default
    try:
        font_large_path = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'Outfit-Bold.ttf')
        font_medium_path = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'Outfit-Regular.ttf')
        font_large = ImageFont.truetype(font_large_path, 90)
        font_medium = ImageFont.truetype(font_medium_path, 55)
    except IOError:
        # Fallback to default if font file structure isn't there yet
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
    
    # Text
    draw.text((100, 400), f"¡{user_name} ya tiene", font=font_medium, fill="white")
    draw.text((100, 500), "SU ENTRADA PARA", font=font_medium, fill="white")
    
    # Wrapping event name if too long or just placing it
    draw.text((100, 600), event_name.upper(), font=font_large, fill="#FF4747") # Color acento
    
    draw.text((100, 1500), "🔥 ¿Te lo vas a perder?", font=font_medium, fill="#FFFFFF")
    draw.text((100, 1600), "Consigue la tuya en el link 👇", font=font_medium, fill="#A8A8A8")
    
    buffer = io.BytesIO()
    card.convert('RGB').save(buffer, format='JPEG', quality=95)
    return ContentFile(buffer.getvalue(), name=f'social_card_{user_name}.jpg')
