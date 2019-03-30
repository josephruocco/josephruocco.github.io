<div class="pin">
<?php include "templates/include/header.php" ?>
 <?php include "templates/admin/include/header.php" ?>


      <div id="adminHeader">
        <h2>Joseph Ruocco</h2>
        <p>You are logged in as <b><?php echo htmlspecialchars( $_SESSION['username']) ?></b>. <a href="admin.php?action=logout"?>Log out</a></p>
      </div>
 
      <h1>All Articles</h1>
 
<?php if ( isset( $results['errorMessage'] ) ) { ?>
        <div class="errorMessage"><?php echo $results['errorMessage'] ?></div>
<?php } ?>
 
 
<?php if ( isset( $results['statusMessage'] ) ) { ?>
        <div class="statusMessage"><?php echo $results['statusMessage'] ?></div>
<?php } ?>
 
      <table>
        <tr>
          <th>Publication Date</th>
          <th>Article</th>
           <th>Category</th>
        </tr>
 
<?php foreach ( $results['articles'] as $article ) { ?>
 
        <tr onclick="location='admin.php?action=editArticle&amp;articleId=<?php echo $article->id?>'">
          <td>
            <?php echo $article->title?>
          </td>
           <td>
            <?php echo $results['categories'][$article->categoryId]->name?>
          </td>
        </tr>
 
<?php } ?>
 
      </table>

 
      <p><a href="admin.php?action=newArticle">Add a New Article</a></p>
 
<?php include "templates/include/footer.php" ?>
<div>