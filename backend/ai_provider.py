"""Direct OpenAI calls; provider credentials never enter the browser."""
import base64
import os

from openai import AsyncOpenAI


async def extract_json(system_prompt, user_text, *, file_bytes=None, content_type=None):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        raise RuntimeError('OPENAI_API_KEY is not configured')
    content = [{'type': 'text', 'text': user_text}]
    if file_bytes:
        mime = content_type or 'image/jpeg'
        encoded = base64.b64encode(file_bytes).decode('ascii')
        if mime == 'application/pdf':
            content.append({'type': 'file', 'file': {'filename': 'document.pdf', 'file_data': f'data:application/pdf;base64,{encoded}'}})
        elif mime in ('image/jpeg', 'image/jpg', 'image/png', 'image/webp'):
            content.append({'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,{encoded}'}})
        else:
            raise ValueError('Convert this document to PDF, JPEG, PNG or WebP before AI verification')
    async with AsyncOpenAI(api_key=key, timeout=60, max_retries=1) as client:
        result = await client.chat.completions.create(
            model=os.environ.get('OPENAI_MODEL', 'gpt-4.1'),
            messages=[{'role': 'system', 'content': system_prompt}, {'role': 'user', 'content': content}],
            response_format={'type': 'json_object'},
        )
    return result.choices[0].message.content or '{}'
