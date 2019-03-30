<?php include "templates/include/header.php" ?>

<h1 style="margin-bottom: 10px;"><?php echo htmlspecialchars( $results['pageHeading'] ) ?></h1>
<?php if ( $results['category'] ) { ?>
      <h3 class="categoryDescription"><?php echo htmlspecialchars( $results['category']->description ) ?></h3>
<?php } ?>
 
      <ul id="headlines" class="archive">
 
<?php foreach ( $results['articles'] as $article ) { ?>
 
        <li>
          <h3>
            <span class="pubDate"></span><a href=".?action=viewArticle&amp;articleId=<?php echo $article->id?>"><?php echo htmlspecialchars( $article->title )?></a>
          <?php if ( !$results['category'] && $article->categoryId ) { ?>
            <span class="category">in <a href=".?action=archive&amp;categoryId=<?php echo $article->categoryId?>"><?php echo htmlspecialchars( $results['categories'][$article->categoryId]->name ) ?></a></span>
<?php } ?> 
          </h3>
            <p class="summary">
            <?php if ( $imagePath = $article->getImagePath( IMG_TYPE_THUMB ) ) { ?>
              <a href=".?action=viewArticle&amp;articleId=<?php echo $article->id?>"><img class="articleImageThumb" src="<?php echo $imagePath?>" alt="Article Thumbnail" /></a>
            <?php } ?>
          <?php echo htmlspecialchars( $article->summary )?>
          </p>
          
        </li>
 
<?php } ?>
 
      </ul>
 
      <p><?php echo $results['totalRows']?> article<?php echo ( $results['totalRows'] != 1 ) ? 's' : '' ?> in total.</p>
 
     
 
 <div id="chars" class="clearfix">
		<div id="reg" class="drawer clearfix">
    </div>
</div>

 <p><a href="./">Return to Homepage</a></p>