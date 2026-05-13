# AI Image Generation Fix Plan for Products.tsx

## Current Issues Identified

### 1. Malformed URL (Line 94)
```typescript
// Current (incorrect):
const iRes = await fetch("[https://openrouter.ai/api/v1/chat/completions](https://openrouter.ai/api/v1/chat/completions)", {

// Should be:
const iRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
```

### 2. Incorrect API Usage for Image Generation
The current implementation uses the chat completions endpoint with `flux-2-klein-4b` model, but:
- Image generation models on OpenRouter may require different parameters
- Response format for image generation differs from text generation

### 3. Response Parsing Issues (Line 104)
```typescript
const url = iData.choices?.[0]?.message?.content || iData.data?.[0]?.url
```
This assumes the image URL is in the message content or a data array, but OpenRouter's image generation might return:
- Base64 encoded image data
- URL in a different field structure
- Multiple images in different format

### 4. Error Handling
- Limited error reporting
- No validation of API response structure
- No fallback mechanisms

## Proposed Solution

### 1. Fix URL Formatting
Remove markdown formatting from the fetch URL.

### 2. Use Correct OpenRouter Image Generation Pattern
Based on OpenRouter documentation, image generation with models like `flux-2-klein-4b` should use:
- Same `/api/v1/chat/completions` endpoint
- Proper `messages` structure with image generation prompts
- May need to specify `response_format` or other parameters

### 3. Update Response Parsing
Implement robust response parsing that handles:
- Direct image URLs in message content
- Base64 encoded images
- Error responses from API

### 4. Enhanced Error Handling
- Add detailed error messages
- Validate API key presence
- Handle network failures
- Provide user feedback during generation

## New Requirement: Immediate Image Display
**User Request**: "when u created 1 image. pl. upload like manual upload. at least i can see the created images"

This means we need to:
1. Save each image to Supabase immediately after generation (not wait for all 4)
2. Update the UI to show each image as it's created
3. Provide real-time feedback on progress

## Implementation Steps

### Step 1: Fix Basic Syntax Errors
- Fix malformed URL on line 94
- Ensure consistent error state management

### Step 2: Research OpenRouter Image Generation API
- Check actual response format for `flux-2-klein-4b`
- Determine if additional parameters are needed

### Step 3: Update `generateAiImages` Function for Immediate Display
```typescript
const generateAiImages = async () => {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) { setImgErr('API Key missing'); return }
  
  setIsAiProcessing(true);
  setImgErr('');
  setImgMsg('🤖 Starting AI image generation...')
  
  try {
    // 1. Get prompts (existing logic is fine)
    const pRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [{
          role: "user",
          content: `Generate 4 prompts for product: ${form.product_name}. Return ONLY a JSON array of strings.`
        }],
        response_format: { type: "json_object" }
      })
    })
    
    if (!pRes.ok) {
      throw new Error(`Prompt generation failed: ${pRes.statusText}`)
    }
    
    const pData = await pRes.json()
    let raw = pData.choices[0].message.content.trim()
    if (raw.startsWith('```')) raw = raw.replace(/```json|```/g, '')
    const aiPrompts = JSON.parse(raw).prompts || JSON.parse(raw)
    
    if (!Array.isArray(aiPrompts) || aiPrompts.length === 0) {
      throw new Error('No valid prompts generated')
    }
    
    // 2. Generate images sequentially with immediate display
    for (let i = 0; i < aiPrompts.length; i++) {
      setImgMsg(`✨ Generating image ${i + 1} of ${aiPrompts.length}...`)
      
      const iRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin // Required by OpenRouter
        },
        body: JSON.stringify({
          model: "black-forest-labs/flux-2-klein-4b",
          messages: [{
            role: "user",
            content: aiPrompts[i]
          }]
        })
      })
      
      if (!iRes.ok) {
        const errorText = await iRes.text()
        throw new Error(`Image generation failed (${iRes.status}): ${errorText}`)
      }
      
      const iData = await iRes.json()
      
      // Extract image URL
      let imageUrl = extractImageUrl(iData)
      
      if (!imageUrl) {
        console.warn('Image generation response:', iData)
        throw new Error('No image URL found in API response')
      }
      
      // Save to Supabase IMMEDIATELY (like manual upload)
      setImgMsg(`💾 Saving image ${i + 1}...`)
      const { data: newImg, error: insertError } = await supabase
        .from('product_images')
        .insert({
          product_id: form.product_id,
          image_url: imageUrl,
          caption: `AI Variant ${i + 1}`,
          sort_order: images.length + i + 1
        })
        .select()
        .single()
      
      if (insertError) {
        throw new Error(`Failed to save image: ${insertError.message}`)
      }
      
      // Update UI immediately (like manual upload does)
      if (newImg) {
        setImages(prev => [...prev, newImg])
        setImgMsg(`✅ Image ${i + 1} saved and displayed!`)
      }
      
      // Small delay between images to avoid rate limiting
      if (i < aiPrompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    setImgMsg(`✅ ${aiPrompts.length} AI variations generated and displayed!`)
  } catch (e: any) {
    setImgErr(`AI Generation Failed: ${e.message}`)
    console.error('AI generation error:', e)
  } finally {
    setIsAiProcessing(false)
  }
}
```

### Step 4: Enhanced UI Feedback
- Show progress for each image (1/4, 2/4, etc.)
- Display success message after each image
- Ensure images appear in grid immediately after saving

### Step 4: Create `extractImageUrl` Helper
```typescript
function extractImageUrl(response: any): string | null {
  // Try different response formats
  if (response.choices?.[0]?.message?.content) {
    const content = response.choices[0].message.content
    // Check if content is a URL
    if (content.startsWith('http')) return content
    // Check if content is base64 image
    if (content.startsWith('data:image')) return content
  }
  
  if (response.data?.[0]?.url) return response.data[0].url
  if (response.url) return response.url
  
  return null
}
```

### Step 5: Testing Strategy
1. Test with mock API responses
2. Verify Supabase integration
3. Test error scenarios
4. Validate UI feedback

## Questions for Clarification

1. What specific error messages are you seeing when AI generation fails?
2. Have you verified the OpenRouter API key has permissions for image generation?
3. Should we implement a fallback to a different image generation service if OpenRouter fails?
4. Do you want to keep the 4-image batch generation or make it configurable?

## Success Criteria
- AI image generation button works without errors
- 4 product variation images are generated and saved
- Proper user feedback during generation process
- Images appear in the product images grid immediately
- Error messages are clear and actionable