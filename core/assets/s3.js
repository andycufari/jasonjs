// core/assets/s3.js - S3 Asset Management
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

export async function listFiles(domain) {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `${domain}/`,
      Delimiter: '/'
    });
  
    const response = await s3Client.send(command);
  
    let tree = [];
    
    // Process common prefixes (folders)
    if (response.CommonPrefixes) {
      for (const prefix of response.CommonPrefixes) {
        const folderName = prefix.Prefix.split('/').slice(-2)[0];
        tree.push({
          id: prefix.Prefix,
          name: folderName,
          isFolder: true,
          children: await listFiles(prefix.Prefix.slice(0, -1))  // Recursive call for subfolders
        });
      }
    }
  
    // Process contents (files)
    if (response.Contents) {
      for (const item of response.Contents) {
        const fileName = item.Key.split('/').pop();
        if (fileName) {  // Ignore the "folder" objects
          tree.push({
            id: item.Key,
            name: fileName,
            size: item.Size,
            lastModified: item.LastModified,
            url: `https://${BUCKET_NAME}.s3.amazonaws.com/${item.Key}`,
            isFolder: false
          });
        }
      }
    }
  
    return tree;
}

export async function createFolder(domain, folderName, parentFolder = null) {
  let key = `${domain}/${folderName}/`;
  if (parentFolder) {
    key = `${parentFolder}${folderName}/`;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: '', // Empty body for folder creation
  });

  await s3Client.send(command);

  return { folderId: key };
}

export async function uploadFile(file, domain, folder = '') {
  const buffer = await file.arrayBuffer();
  let key;

  if (folder) {
    key = `${folder}${file.name}`;
  } else {
    key = `${domain}/${file.name}`;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: file.type,
  });

  await s3Client.send(command);

  return {
    url: `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`,
  };
}

export async function deleteFile(key) {
  if (key.endsWith('/')) {
    // It's a folder, delete all contents
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: key,
    });

    const listedObjects = await s3Client.send(listCommand);

    if (listedObjects.Contents.length === 0) return;

    const deletePromises = listedObjects.Contents.map(({ Key }) => {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key,
      });
      return s3Client.send(deleteCommand);
    });

    await Promise.all(deletePromises);
  } else {
    // It's a file, delete it directly
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  }
}