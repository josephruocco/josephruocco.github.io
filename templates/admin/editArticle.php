<?php include "templates/include/header.php" ?>
 <?php include "templates/admin/include/header.php" ?>
 
 <script>
 
      // Prevents file upload hangs in Mac Safari
      // Inspired by http://airbladesoftware.com/notes/note-to-self-prevent-uploads-hanging-in-safari
 
      function closeKeepAlive() {
        if ( /AppleWebKit|MSIE/.test( navigator.userAgent) ) {
          var xhr = new XMLHttpRequest();
          xhr.open( "GET", "/ping/close", false );
          xhr.send();
        }
      }
 
      </script>
 
      <div id="adminHeader">
        <h2> Admin</h2>
        <p>You are logged in as <b><?php echo htmlspecialchars( $_SESSION['username']) ?></b>. <a href="admin.php?action=logout"?>Log out</a></p>
      </div>
 
      <h1><?php echo $results['pageTitle']?></h1>
      
        <form action="admin.php?action=<?php echo $results['formAction']?>" method="post" enctype="multipart/form-data" onsubmit="closeKeepAlive()">
        <input type="hidden" name="articleId" value="<?php echo $results['article']->id ?>"/>
 
<?php if ( isset( $results['errorMessage'] ) ) { ?>
        <div class="errorMessage"><?php echo $results['errorMessage'] ?></div>
<?php } ?>
 
        <ul>
 
          <li>
            <label for="title">Article Title</label>
            <input type="text" name="title" id="title" placeholder="Name of the article" required autofocus maxlength="255" value="<?php echo htmlspecialchars( $results['article']->title )?>" />
          </li>
 
          <li>
            <label for="summary">Article Summary</label>
            <textarea name="summary" id="summary" placeholder="Brief description of the article" required maxlength="1000" style="height: 5em;"><?php echo htmlspecialchars( $results['article']->summary )?></textarea>
          </li>
 
          <li>
            <label for="content">Article Content</label>
            <textarea name="content" id="content" placeholder="The HTML content of the article" required maxlength="100000" style="height: 30em;"><?php echo htmlspecialchars( $results['article']->content )?></textarea>
          </li>
 
         <li>
            <label for="categoryId">Article Category</label>
            <select name="categoryId">
              <option value="0"<?php echo !$results['article']->categoryId ? " selected" : ""?>>(none)</option>
            <?php foreach ( $results['categories'] as $category ) { ?>
              <option value="<?php echo $category->id?>"<?php echo ( $category->id == $results['article']->categoryId ) ? " selected" : ""?>><?php echo htmlspecialchars( $category->name )?></option>
            <?php } ?>
            </select>
          </li>
 
 
          <li>
            <label for="publicationDate">Publication Date</label>
            <input type="date" name="publicationDate" id="publicationDate" placeholder="YYYY-MM-DD" required maxlength="10" value="<?php echo $results['article']->publicationDate ? date( "Y-m-d", $results['article']->publicationDate ) : "" ?>" />
          </li>
 
  <?php if ( $results['article'] && $imagePath = $results['article']->getImagePath() ) { ?>
          <li>
            <label>Current Image</label>
            <img id="articleImage" src="<?php echo $imagePath ?>" alt="Article Image" />
          </li>
 
          <li>
            <label></label>
            <input type="checkbox" name="deleteImage" id="deleteImage" value="yes"/> 
            <label for="deleteImage">Delete</label>
          </li>
          <?php } ?>
 
          <li>
          
            <label for="image">New Image</label>
            <input type="file" name="image" id="image" placeholder="Choose an image to upload" maxlength="255" />
          </li>
 

 
        </ul>
 
        <div class="buttons">
          <input type="submit" name="saveChanges" value="Save Changes" />
          <input type="submit" formnovalidate name="cancel" value="Cancel" />
        </div>
 
      </form>
 
<?php if ( $results['article']->id ) { ?>
      <p><a href="admin.php?action=deleteArticle&amp;articleId=<?php echo $results['article']->id ?>" onclick="return confirm('Delete This Article?')">Delete This Article</a></p>
<?php } ?>
 
<?php include "templates/include/footer.php" ?>