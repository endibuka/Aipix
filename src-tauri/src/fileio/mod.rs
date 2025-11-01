// File I/O operations for loading and saving images
use image::{ImageError, RgbaImage};
use std::path::Path;

pub fn load_image(path: &Path) -> Result<RgbaImage, ImageError> {
    let img = image::open(path)?;
    Ok(img.to_rgba8())
}

pub fn save_image(path: &Path, img: &RgbaImage) -> Result<(), ImageError> {
    img.save(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_image_operations() {
        // Basic test placeholder
        // TODO: Add comprehensive tests
    }
}
